const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const db = require('../config/database');
const blockService = require('../services/blockService');

const router = express.Router();

// Create appeal
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { appeal_type, target_id, reason, evidence } = req.body;
    
    const result = await db.query(
      `INSERT INTO appeals (user_id, appeal_type, target_id, reason, evidence, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [req.user.id, appeal_type, target_id, reason, evidence || []]
    );
    
    res.status(201).json({ appeal: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user appeals
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, m.username as moderator_name
       FROM appeals a
       LEFT JOIN users m ON a.moderator_id = m.id
       WHERE a.user_id = $1
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    
    res.json({ appeals: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all appeals (admin/moderator)
router.get('/', authenticateToken, authorizeRole('admin', 'moderator'), async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT a.*, u.username as user_name, m.username as moderator_name
      FROM appeals a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN users m ON a.moderator_id = m.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (status) {
      query += ` AND a.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY a.created_at DESC`;
    
    const result = await db.query(query, params);
    
    res.json({ appeals: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Review appeal
router.post('/:id/review', authenticateToken, authorizeRole('admin', 'moderator'), async (req, res) => {
  try {
    const { status, moderator_notes, action } = req.body;
    
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const appeal = await client.query(
        `UPDATE appeals 
         SET status = $1, moderator_notes = $2, moderator_id = $3, resolved_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [status, moderator_notes, req.user.id, req.params.id]
      );
      
      if (appeal.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Appeal not found' });
      }
      
      // If appeal is approved and it's a block appeal, unblock user
      if (status === 'approved' && appeal.rows[0].appeal_type === 'block') {
        await blockService.unblockUser(appeal.rows[0].user_id, req.user.id);
      }
      
      await client.query('COMMIT');
      
      res.json({ appeal: appeal.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;