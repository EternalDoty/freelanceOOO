const db = require('../config/database');
const redisClient = require('../config/redis');

async function blockUser(userId, reason, duration = null, moderatorId = null) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const blockedUntil = duration ? 
      new Date(Date.now() + duration * 24 * 60 * 60 * 1000) : null;
    
    const result = await client.query(
      `UPDATE users 
       SET is_blocked = TRUE, 
           block_reason = $1, 
           blocked_until = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [reason, blockedUntil, userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    if (moderatorId) {
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_value)
         VALUES ($1, 'BLOCK_USER', 'user', $2, $3)`,
        [moderatorId, userId, JSON.stringify({ reason, blockedUntil })]
      );
    }
    
    await client.query('COMMIT');
    
    await redisClient.publish('user_blocked', JSON.stringify({
      userId,
      reason,
      blockedUntil
    }));
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function unblockUser(userId, moderatorId = null) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      `UPDATE users 
       SET is_blocked = FALSE, 
           block_reason = NULL, 
           blocked_until = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    if (moderatorId) {
      await client.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id)
         VALUES ($1, 'UNBLOCK_USER', 'user', $2)`,
        [moderatorId, userId]
      );
    }
    
    await client.query('COMMIT');
    
    await redisClient.publish('user_unblocked', JSON.stringify({ userId }));
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function checkHardwareBlock(fingerprint) {
  const result = await db.query(
    `SELECT * FROM users WHERE hardware_fingerprint = $1 AND is_blocked = TRUE`,
    [fingerprint]
  );
  
  return result.rows.length > 0;
}

async function setHardwareFingerprint(userId, fingerprint) {
  await db.query(
    `UPDATE users SET hardware_fingerprint = $1 WHERE id = $2`,
    [fingerprint, userId]
  );
}

async function getUserBlockStatus(userId) {
  const result = await db.query(
    `SELECT is_blocked, block_reason, blocked_until FROM users WHERE id = $1`,
    [userId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }
  
  const user = result.rows[0];
  const isCurrentlyBlocked = user.is_blocked && 
    (!user.blocked_until || user.blocked_until > new Date());
  
  return {
    isBlocked: isCurrentlyBlocked,
    reason: user.block_reason,
    blockedUntil: user.blocked_until
  };
}

module.exports = {
  blockUser,
  unblockUser,
  checkHardwareBlock,
  setHardwareFingerprint,
  getUserBlockStatus
};