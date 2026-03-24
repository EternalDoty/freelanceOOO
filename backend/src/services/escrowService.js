const db = require('../config/database');
const redisClient = require('../config/redis');

const ESCROW_STATES = {
  INIT: 'INIT',
  FUNDED: 'FUNDED',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_RELEASE: 'PENDING_RELEASE',
  RELEASED: 'RELEASED',
  REFUNDED: 'REFUNDED',
  DISPUTE: 'DISPUTE'
};

async function getCommissionRate(amount) {
  const result = await db.query(
    `SELECT rate FROM commission_rates 
     WHERE is_active = TRUE 
     AND min_amount <= $1 
     AND (max_amount IS NULL OR max_amount >= $1)
     ORDER BY min_amount DESC
     LIMIT 1`,
    [amount]
  );
  
  return result.rows[0]?.rate || 0.01;
}

async function calculateCommission(amount) {
  const rate = await getCommissionRate(amount);
  const commission = amount * rate;
  const netAmount = amount - commission;
  
  return { rate, commission, netAmount };
}

async function createEscrowTransaction(taskId, customerId, freelancerId, amount) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const { rate, commission, netAmount } = await calculateCommission(amount);
    
    const result = await client.query(
      `INSERT INTO escrow_transactions 
       (task_id, customer_id, freelancer_id, amount, commission, net_amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [taskId, customerId, freelancerId, amount, commission, netAmount, ESCROW_STATES.INIT]
    );
    
    await client.query(
      `UPDATE tasks SET escrow_status = $1 WHERE id = $2`,
      [ESCROW_STATES.INIT, taskId]
    );
    
    await client.query('COMMIT');
    
    await redisClient.publish('escrow_created', JSON.stringify(result.rows[0]));
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function fundEscrow(transactionId, walletTransactionId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      `UPDATE escrow_transactions 
       SET status = $1, wallet_transaction_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [ESCROW_STATES.FUNDED, walletTransactionId, transactionId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Escrow transaction not found');
    }
    
    await client.query(
      `UPDATE tasks SET escrow_status = $1 WHERE id = $2`,
      [ESCROW_STATES.FUNDED, result.rows[0].task_id]
    );
    
    await client.query('COMMIT');
    
    await redisClient.publish('escrow_funded', JSON.stringify(result.rows[0]));
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function releaseEscrow(transactionId, moderatorId = null) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const transaction = await client.query(
      'SELECT * FROM escrow_transactions WHERE id = $1 FOR UPDATE',
      [transactionId]
    );
    
    if (transaction.rows.length === 0) {
      throw new Error('Escrow transaction not found');
    }
    
    if (transaction.rows[0].status === ESCROW_STATES.DISPUTE && !moderatorId) {
      throw new Error('Disputed escrow requires moderator approval');
    }
    
    const result = await client.query(
      `UPDATE escrow_transactions 
       SET status = $1, released_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [ESCROW_STATES.RELEASED, transactionId]
    );
    
    await client.query(
      `UPDATE tasks SET escrow_status = $1, status = 'completed' WHERE id = $2`,
      [ESCROW_STATES.RELEASED, result.rows[0].task_id]
    );
    
    await client.query(
      `UPDATE users SET completed_tasks = completed_tasks + 1, total_tasks = total_tasks + 1 
       WHERE id = $1`,
      [result.rows[0].freelancer_id]
    );
    
    await client.query('COMMIT');
    
    await redisClient.publish('escrow_released', JSON.stringify(result.rows[0]));
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function refundEscrow(transactionId) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    const result = await client.query(
      `UPDATE escrow_transactions 
       SET status = $1, refunded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [ESCROW_STATES.REFUNDED, transactionId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Escrow transaction not found');
    }
    
    await client.query(
      `UPDATE tasks SET escrow_status = $1, status = 'cancelled' WHERE id = $2`,
      [ESCROW_STATES.REFUNDED, result.rows[0].task_id]
    );
    
    await client.query('COMMIT');
    
    await redisClient.publish('escrow_refunded', JSON.stringify(result.rows[0]));
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function disputeEscrow(transactionId, userId, reason, evidence = []) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    await client.query(
      `UPDATE escrow_transactions SET status = $1 WHERE id = $2`,
      [ESCROW_STATES.DISPUTE, transactionId]
    );
    
    const dispute = await client.query(
      `INSERT INTO disputes 
       (escrow_transaction_id, opened_by, reason, evidence, status)
       VALUES ($1, $2, $3, $4, 'open')
       RETURNING *`,
      [transactionId, userId, reason, evidence]
    );
    
    await client.query(
      `UPDATE tasks SET escrow_status = $1, status = 'disputed' WHERE id = 
       (SELECT task_id FROM escrow_transactions WHERE id = $2)`,
      [ESCROW_STATES.DISPUTE, transactionId]
    );
    
    await client.query('COMMIT');
    
    await redisClient.publish('escrow_disputed', JSON.stringify({
      transactionId,
      dispute: dispute.rows[0]
    }));
    
    return dispute.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getEscrowStatus(transactionId) {
  const result = await db.query(
    `SELECT et.*, t.title as task_title, 
            c.username as customer_name, f.username as freelancer_name
     FROM escrow_transactions et
     JOIN tasks t ON et.task_id = t.id
     JOIN users c ON et.customer_id = c.id
     JOIN users f ON et.freelancer_id = f.id
     WHERE et.id = $1`,
    [transactionId]
  );
  
  return result.rows[0];
}

module.exports = {
  ESCROW_STATES,
  getCommissionRate,
  calculateCommission,
  createEscrowTransaction,
  fundEscrow,
  releaseEscrow,
  refundEscrow,
  disputeEscrow,
  getEscrowStatus
};