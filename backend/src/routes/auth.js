const express = require('express');
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');
const { authLimiter } = require('../middleware/rateLimit');
const blockService = require('../services/blockService');
require('dotenv').config();

const router = express.Router();

router.get('/github', authLimiter, (req, res, next) => {
  console.log('DEBUG: /api/auth/github called');
  passport.authenticate('github', { session: false })(req, res, next);
});

router.get('/github/callback', (req, res, next) => {
  passport.authenticate('github', { session: false, failureRedirect: '/login' }, async (err, user, info) => {
    if (err) {
      console.error('Passport callback error:', err);
      console.error('Passport callback info:', info);
      const errorInfo = encodeURIComponent((err.message || 'oauth_error').substring(0, 150));
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error&details=${errorInfo}`);
    }
    if (!user) {
      console.warn('Passport callback no user:', info);
      const infoMsg = encodeURIComponent((info?.message || 'auth_failed').substring(0, 150));
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed&details=${infoMsg}`);
    }

    try {
      const { token } = user;
      const blockStatus = await blockService.getUserBlockStatus(user.id);
      const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}&blocked=${blockStatus?.isBlocked || false}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Auth callback error:', error);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }
  })(req, res, next);
});

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    console.log('Verify token:', token.substring(0, 50) + '...');
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded:', decoded);
    
    const db = require('../config/database');
    const user = await db.query(
      'SELECT id, username, email, role, avatar_url, rating FROM users WHERE id = $1',
      [decoded.userId]
    );
    console.log('User query result:', user.rows.length);
    
    if (user.rows.length === 0) {
      console.log('User not found for id:', decoded.userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('User found:', user.rows[0]);
    res.json({ user: user.rows[0] });
  } catch (error) {
    console.error('Verify error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

router.get('/me', require('../middleware/auth').authenticateToken, async (req, res) => {
  try {
    const { id, username, email, role, avatar_url, rating, total_tasks, completed_tasks } = req.user;
    
    res.json({
      user: {
        id,
        username,
        email,
        role,
        avatar_url,
        rating,
        total_tasks,
        completed_tasks
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;