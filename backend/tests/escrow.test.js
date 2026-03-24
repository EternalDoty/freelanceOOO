const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/database');
const escrowService = require('../src/services/escrowService');

describe('Escrow Service', () => {
  let testUserId;
  let testTaskId;
  let testTransactionId;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.query(
      `INSERT INTO users (github_id, username, email, role)
       VALUES ('test_github_id', 'testuser', 'test@example.com', 'customer')
       RETURNING id`
    );
    testUserId = userResult.rows[0].id;

    // Create test task
    const taskResult = await db.query(
      `INSERT INTO tasks (customer_id, title, description, budget_min, budget_max)
       VALUES ($1, 'Test Task', 'Test Description', 1000, 5000)
       RETURNING id`
    );
    testTaskId = taskResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup
    await db.query('DELETE FROM escrow_transactions WHERE task_id = $1', [testTaskId]);
    await db.query('DELETE FROM tasks WHERE id = $1', [testTaskId]);
    await db.query('DELETE FROM users WHERE github_id = $1', ['test_github_id']);
    await db.pool.end();
  });

  test('should create escrow transaction', async () => {
    const transaction = await escrowService.createEscrowTransaction(
      testTaskId,
      testUserId,
      testUserId,
      5000
    );

    expect(transaction).toBeDefined();
    expect(transaction.amount).toBe(5000);
    expect(transaction.status).toBe('INIT');
    testTransactionId = transaction.id;
  });

  test('should calculate commission correctly', async () => {
    const result = await escrowService.calculateCommission(5000);
    
    expect(result.rate).toBe(0.01); // 1% for < 10000
    expect(result.commission).toBe(50);
    expect(result.netAmount).toBe(4950);
  });

  test('should fund escrow', async () => {
    const updated = await escrowService.fundEscrow(testTransactionId, 'wallet_tx_123');
    
    expect(updated.status).toBe('FUNDED');
    expect(updated.wallet_transaction_id).toBe('wallet_tx_123');
  });

  test('should release escrow', async () => {
    // First set to PENDING_RELEASE
    await db.query(
      `UPDATE escrow_transactions SET status = 'PENDING_RELEASE' WHERE id = $1`,
      [testTransactionId]
    );

    const released = await escrowService.releaseEscrow(testTransactionId);
    
    expect(released.status).toBe('RELEASED');
    expect(released.released_at).toBeDefined();
  });
});