const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'customer-status-test-secret';

const db = require('./db');
const { app } = require('./index');
const { signBasicUserToken, signSupervisorToken, signCustomerToken } = require('./auth');

test('internal users can manually change customer status and the change is audited', async () => {
  const originalQuery = db.query;
  const auditInserts = [];
  const statusUpdates = [];
  let currentStatus = 'approved';

  db.query = async (sql, params = []) => {
    if (sql.includes('SELECT status FROM applications')) return [[{ status: currentStatus }]];
    if (sql.includes('UPDATE applications SET status')) {
      statusUpdates.push(params);
      currentStatus = params[0];
      return [{ affectedRows: 1 }];
    }
    if (sql.includes('INSERT INTO audit_logs')) {
      auditInserts.push(params);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/internal/customers/19195550147/status`;

  try {
    const response = await fetch(base, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signBasicUserToken({ id: 12, name: 'Jordan Lee' })}`,
      },
      body: JSON.stringify({ status: 'rejected' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'rejected');
    assert.equal(statusUpdates.length, 1);
    assert.equal(auditInserts.length, 1);
    assert.equal(auditInserts[0][1], 'Jordan Lee');
    assert.equal(auditInserts[0][2], 'basic');
    assert.equal(auditInserts[0][3], 'customer_status_changed');
    assert.deepEqual(JSON.parse(auditInserts[0][6]), {
      previousStatus: 'approved',
      newStatus: 'rejected',
      reason: 'manual_status_change',
    });

    const supervisorRestore = await fetch(base, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signSupervisorToken({ id: 7, name: 'Maria Rodriguez' })}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(supervisorRestore.status, 200);

    const customerAttempt = await fetch(base, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signCustomerToken('19195550147')}`,
      },
      body: JSON.stringify({ status: 'rejected' }),
    });
    assert.equal(customerAttempt.status, 403);

    const invalidStatus = await fetch(base, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signSupervisorToken({ id: 7 })}`,
      },
      body: JSON.stringify({ status: 'suspended' }),
    });
    assert.equal(invalidStatus.status, 400);
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});
