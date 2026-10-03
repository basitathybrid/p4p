const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'basic-tier-thresholds-test-secret';

const db = require('./db');
const { app } = require('./index');
const { signBasicUserToken } = require('./auth');

test('basic user can update tier thresholds and the change is audited', async () => {
  const originalGetConnection = db.getConnection;
  const auditInserts = [];
  const updates = [];
  db.getConnection = async () => ({
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async query(sql, params = []) {
      if (sql.includes('FROM tier_thresholds')) {
        return [[
          { name: 'Bronze', minimum: 0 },
          { name: 'Silver', minimum: 5000 },
          { name: 'Gold', minimum: 10000 },
          { name: 'Diamond', minimum: 15000 },
        ]];
      }
      if (sql.includes('UPDATE tier_thresholds')) {
        updates.push(params);
        return [{}];
      }
      if (sql.includes('SELECT phone, lifetime_transaction_volume, reward_tier FROM customer_usage')) return [[]];
      if (sql.includes('INSERT INTO audit_logs')) {
        auditInserts.push(params);
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tier-thresholds`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signBasicUserToken({ id: 12, name: 'Jordan Lee' })}`,
      },
      body: JSON.stringify({
        thresholds: [
          { name: 'Bronze', minimum: 0 },
          { name: 'Silver', minimum: 4000 },
          { name: 'Gold', minimum: 9000 },
          { name: 'Diamond', minimum: 14000 },
        ],
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(updates.length, 4);
    assert.equal(auditInserts.length, 1);
    assert.equal(auditInserts[0][1], 'Jordan Lee');
    assert.equal(auditInserts[0][2], 'basic');
    assert.equal(auditInserts[0][3], 'tier_thresholds_updated');
  } finally {
    db.getConnection = originalGetConnection;
    await new Promise((resolve) => server.close(resolve));
  }
});
