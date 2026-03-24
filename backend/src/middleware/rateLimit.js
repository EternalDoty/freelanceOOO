const rateLimit = require('express-rate-limit');
const redisClient = require('../config/redis');

const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new (require('rate-limit-redis')).RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts' },
});

module.exports = { apiLimiter, authLimiter };