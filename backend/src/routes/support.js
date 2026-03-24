const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const aiSupportService = require('../services/aiSupportService');
const db = require('../config/database');

const router = express.Router();

// Create support ticket
router.post('/tickets', authenticateToken, async (req, res) => {
  try {
    const { subject, messages, category } = req.body;
    
    const ticket = await aiSupportService.createSupportTicket(
      req.user.id,
      subject,
      messages || [],
      category
    );
    
    res.status(201).json({ ticket });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message to ticket
router.post('/tickets/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    
    const ticket = await db.query(
      'SELECT * FROM support_tickets WHERE id = $1',
      [req.params.id]
    );
    
    if (ticket.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    if (ticket.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await aiSupportService.processSupportMessage(
      req.params.id,
      req.user.id,
      message
    );
    
    res.json({ 
      response: result.response,
      confidence: result.confidence,
      escalate: result.escalate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user tickets
router.get('/tickets/my', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    
    res.json({ tickets: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all tickets (admin/moderator)
router.get('/tickets', authenticateToken, authorizeRole('admin', 'moderator'), async (req, res) => {
  try {
    const { status, assigned } = req.query;
    
    let query = `
      SELECT t.*, u.username as user_name
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (status) {
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (assigned === 'true') {
      query += ` AND t.assigned_moderator IS NOT NULL`;
    } else if (assigned === 'false') {
      query += ` AND t.assigned_moderator IS NULL`;
    }
    
    query += ` ORDER BY t.created_at DESC`;
    
    const result = await db.query(query, params);
    
    res.json({ tickets: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Assign ticket to moderator
router.post('/tickets/:id/assign', authenticateToken, authorizeRole('admin', 'moderator'), async (req, res) => {
  try {
    await aiSupportService.assignTicketToModerator(req.params.id, req.user.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close ticket
router.post('/tickets/:id/close', authenticateToken, authorizeRole('admin', 'moderator'), async (req, res) => {
  try {
    await aiSupportService.closeTicket(req.params.id, req.user.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;