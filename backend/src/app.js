const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('./config/passport');
const { apiLimiter } = require('./middleware/rateLimit');
const db = require('./config/database');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

console.log('DEBUG app.js: GITHUB_CLIENT_ID:', JSON.stringify(process.env.GITHUB_CLIENT_ID));

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Passport
app.use(passport.initialize());

// Rate limiting
app.use('/api', apiLimiter);

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/escrow', require('./routes/escrow'));
app.use('/api/appeals', require('./routes/appeals'));
app.use('/api/support', require('./routes/support'));

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;