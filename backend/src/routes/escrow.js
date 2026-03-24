const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const escrowService = require('../services/escrowService');
const db = require('../config/database');

const router = express.Router();

// Get escrow transaction
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const escrow = await escrowService.getEscrowStatus(req.params.id);
    
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    // Check permissions
    if (escrow.customer_id !== req.user.id && 
        escrow.freelancer_id !== req.user.id && 
        req.user.role !== 'admin' && 
        req.user.role !== 'moderator') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ escrow });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Fund escrow (simulate wallet payment)
router.post('/:id/fund', authenticateToken, async (req, res) => {
  try {
    const { wallet_transaction_id } = req.body;
    
    const escrow = await escrowService.getEscrowStatus(req.params.id);
    
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    if (escrow.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Only customer can fund escrow' });
    }
    
    if (escrow.status !== escrowService.ESCROW_STATES.INIT) {
      return res.status(400).json({ error: 'Escrow cannot be funded in current state' });
    }
    
    const updated = await escrowService.fundEscrow(req.params.id, wallet_transaction_id);
    
    res.json({ escrow: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Release escrow
router.post('/:id/release', authenticateToken, async (req, res) => {
  try {
    const escrow = await escrowService.getEscrowStatus(req.params.id);
    
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    if (escrow.customer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only customer or admin can release escrow' });
    }
    
    if (escrow.status !== escrowService.ESCROW_STATES.PENDING_RELEASE) {
      return res.status(400).json({ error: 'Escrow cannot be released in current state' });
    }
    
    const updated = await escrowService.releaseEscrow(req.params.id);
    
    res.json({ escrow: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dispute escrow
router.post('/:id/dispute', authenticateToken, async (req, res) => {
  try {
    const { reason, evidence } = req.body;
    
    const escrow = await escrowService.getEscrowStatus(req.params.id);
    
    if (!escrow) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    if (escrow.customer_id !== req.user.id && escrow.freelancer_id !== req.user.id) {
      return res.status(403).json({ error: 'Only parties can dispute escrow' });
    }
    
    const dispute = await escrowService.disputeEscrow(req.params.id, req.user.id, reason, evidence);
    
    res.json({ dispute });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refund escrow (admin only)
router.post('/:id/refund', authenticateToken, authorizeRole('admin', 'moderator'), async (req, res) => {
  try {
    const updated = await escrowService.refundEscrow(req.params.id);
    
    res.json({ escrow: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get commission rate
router.get('/commission/calculate', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.query;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount required' });
    }
    
    const { rate, commission, netAmount } = await escrowService.calculateCommission(parseFloat(amount));
    
    res.json({ amount: parseFloat(amount), rate, commission, netAmount });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;