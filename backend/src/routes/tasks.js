const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');
const escrowService = require('../services/escrowService');

const router = express.Router();

// Get all tasks with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, category, min_budget, max_budget, sort = 'created_at', order = 'DESC' } = req.query;
    
    let query = `
      SELECT t.*, u.username as customer_name, u.avatar_url as customer_avatar
      FROM tasks t
      JOIN users u ON t.customer_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (category) {
      query += ` AND t.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }
    
    if (min_budget) {
      query += ` AND t.budget_max >= $${paramCount}`;
      params.push(min_budget);
      paramCount++;
    }
    
    if (max_budget) {
      query += ` AND t.budget_min <= $${paramCount}`;
      params.push(max_budget);
      paramCount++;
    }
    
    if (!req.user.role === 'admin') {
      query += ` AND t.customer_id != $${paramCount}`;
      params.push(req.user.id);
      paramCount++;
    }
    
    query += ` ORDER BY t.${sort} ${order} LIMIT 50`;
    
    const result = await db.query(query, params);
    
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single task
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.username as customer_name, u.avatar_url as customer_avatar,
              u.rating as customer_rating
       FROM tasks t
       JOIN users u ON t.customer_id = u.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const proposals = await db.query(
      `SELECT p.*, u.username as freelancer_name, u.avatar_url as freelancer_avatar, u.rating as freelancer_rating
       FROM proposals p
       JOIN users u ON p.freelancer_id = u.id
       WHERE p.task_id = $1`,
      [req.params.id]
    );
    
    res.json({ 
      task: result.rows[0],
      proposals: proposals.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create task
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, skills, budget_min, budget_max, currency, deadline } = req.body;
    
    if (req.user.role !== 'customer' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only customers can create tasks' });
    }
    
    const result = await db.query(
      `INSERT INTO tasks (customer_id, title, description, category, skills, budget_min, budget_max, currency, deadline)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, title, description, category, skills, budget_min, budget_max, currency || 'RUB', deadline]
    );
    
    res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit proposal
router.post('/:id/proposals', authenticateToken, async (req, res) => {
  try {
    const { message, bid_amount, delivery_days } = req.body;
    
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ error: 'Only freelancers can submit proposals' });
    }
    
    const result = await db.query(
      `INSERT INTO proposals (task_id, freelancer_id, message, bid_amount, delivery_days)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (task_id, freelancer_id) 
       DO UPDATE SET message = $3, bid_amount = $4, delivery_days = $5, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [req.params.id, req.user.id, message, bid_amount, delivery_days]
    );
    
    res.status(201).json({ proposal: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Accept proposal
router.post('/:id/proposals/:proposalId/accept', authenticateToken, async (req, res) => {
  try {
    const task = await db.query(
      'SELECT * FROM tasks WHERE id = $1 AND customer_id = $2',
      [req.params.id, req.user.id]
    );
    
    if (task.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    
    const proposal = await db.query(
      'SELECT * FROM proposals WHERE id = $1 AND task_id = $2',
      [req.params.proposalId, req.params.id]
    );
    
    if (proposal.rows.length === 0) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      await client.query(
        `UPDATE proposals SET status = 'accepted' WHERE id = $1`,
        [req.params.proposalId]
      );
      
      await client.query(
        `UPDATE tasks SET status = 'in_progress', escrow_status = 'INIT' WHERE id = $1`,
        [req.params.id]
      );
      
      const escrow = await escrowService.createEscrowTransaction(
        req.params.id,
        req.user.id,
        proposal.rows[0].freelancer_id,
        proposal.rows[0].bid_amount
      );
      
      await client.query('COMMIT');
      
      res.json({ task: task.rows[0], escrow, proposal: proposal.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;