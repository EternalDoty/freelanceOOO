const request = require('supertest');
const app = require('../src/app');

describe('Authentication', () => {
  test('should return health status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  test('should require token for protected routes', async () => {
    const response = await request(app).get('/api/auth/me');
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Access token required');
  });
});