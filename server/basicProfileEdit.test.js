const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'basic-profile-edit-test-secret';

const db = require('./db');
const { app } = require('./index');
const { signBasicUserToken, signCustomerToken } = require('./auth');

test('basic user can edit an approved customer profile and the change is audited', async () => {
  const originalQuery = db.query;
  const originalGetConnection = db.getConnection;
  const auditInserts = [];
  let application = {
    profile_id: 'profile-1',
    phone: '19195550147',
    name: 'Ava Johnson',
    email: 'ava@example.com',
    player_mobile_id: 'M-1',
    player_id: 1000001,
    facebook: '',
    instagram: '',
    telegram: '',
    status: 'approved',
    submitted_at: new Date('2026-01-01T00:00:00Z'),
    reviewed_at: new Date('2026-01-02T00:00:00Z'),
    review_decision: 'approved',
    review_reviewer: 'Supervisor',
  };

  db.query = async (sql, params = []) => {
    if (sql.includes('SELECT * FROM applications WHERE phone = ?')) return [[application]];
    if (sql.includes('INSERT INTO audit_logs')) {
      auditInserts.push(params);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  db.getConnection = async () => ({
    async query(sql, params = []) {
      if (sql.includes('CALL sp_update_application')) {
        application = { ...application, name: params[1] };
        return [{}];
      }
      if (sql.includes('@p_result_code')) return [[{ result_code: 'OK' }]];
      throw new Error(`Unexpected connection query: ${sql}`);
    },
    release() {},
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/review/applications/19195550147`;

  try {
    const response = await fetch(base, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signBasicUserToken({ id: 12, name: 'Jordan Lee' })}`,
      },
      body: JSON.stringify({ name: 'Ava J. Updated' }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.application.name, 'Ava J. Updated');
    assert.equal(auditInserts.length, 1);
    assert.equal(auditInserts[0][1], 'Jordan Lee');
    assert.equal(auditInserts[0][2], 'basic');
    assert.equal(auditInserts[0][3], 'customer_profile_edited');
    assert.deepEqual(JSON.parse(auditInserts[0][6]), {
      changes: { name: { from: 'Ava Johnson', to: 'Ava J. Updated' } },
    });

    const customerAttempt = await fetch(base, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${signCustomerToken('19195550147')}`,
      },
      body: JSON.stringify({ name: 'Customer Edit' }),
    });
    assert.equal(customerAttempt.status, 403);
    assert.equal(auditInserts.length, 1);
  } finally {
    db.query = originalQuery;
    db.getConnection = originalGetConnection;
    await new Promise((resolve) => server.close(resolve));
  }
});
