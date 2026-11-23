const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'audit-log-test-secret';

const db = require('./db');
const { app } = require('./index');
const { signBasicUserToken, signSupervisorToken, signCustomerToken } = require('./auth');
const { writeAuditLog } = require('./auditLog');

test('profile view audit writes use a stable unique event key for request retries', async () => {
  const originalGetConnection = db.getConnection;
  const statements = [];
  const insertedEventKeys = new Set();
  db.getConnection = async () => ({
    async query(sql, params) {
      statements.push({ sql, params });
      if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
      if (sql.includes('SELECT id FROM audit_logs')) return [insertedEventKeys.has(params[0]) ? [{ id: 1 }] : []];
      if (sql.includes('INSERT INTO audit_logs')) insertedEventKeys.add(params[7]);
      return [[{ released: 1 }]];
    },
    release() {},
  });

  try {
    const eventKey = 'view-request-123';
    const actor = { id: 4, name: 'Casey Supervisor', role: 'supervisor' };
    await writeAuditLog(actor, 'customer_profile_viewed', 'customer', '19195550147', { page: 1 }, db, eventKey);
    await writeAuditLog(actor, 'customer_profile_viewed', 'customer', '19195550147', { page: 1 }, db, eventKey);

    const inserts = statements.filter(({ sql }) => sql.includes('INSERT INTO audit_logs'));
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].params[7], eventKey);
    assert.equal(statements.filter(({ sql }) => sql.includes('GET_LOCK')).length, 2);
  } finally {
    db.getConnection = originalGetConnection;
  }
});

test('audit records are supervisor-only, ordered and paginated with all record details', async () => {
  const originalQuery = db.query;
  const queries = [];
  db.query = async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes('COUNT(*) AS total FROM audit_logs')) return [[{ total: 101 }]];
    if (sql.includes('FROM audit_logs')) return [[{
      id: 8, actorId: 4, actorName: 'Casey Supervisor', actorRole: 'supervisor',
      action: 'customer_profile_updated', targetType: 'customer', targetId: '19195550147',
      details: { changes: { name: { old: 'Old', new: 'New' } } }, createdAt: '2026-11-23T12:00:00Z',
    }]];
    throw new Error(`Unexpected query: ${sql}`);
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/supervisor/audit-logs`;
  const headers = (token) => ({ Authorization: `Bearer ${token}` });
  try {
    assert.equal((await fetch(base)).status, 401);
    for (const token of [signCustomerToken('19195550147'), signBasicUserToken({ id: 4 })]) {
      assert.equal((await fetch(base, { headers: headers(token) })).status, 403);
    }
    assert.equal(queries.length, 0);
    const response = await fetch(`${base}?page=99`, { headers: headers(signSupervisorToken({ id: 4 })) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.pagination, { page: 3, pageSize: 50, pageCount: 3, total: 101 });
    assert.deepEqual(body.logs[0], {
      id: 8, actorId: 4, actorName: 'Casey Supervisor', actorRole: 'supervisor',
      action: 'customer_profile_updated', targetType: 'customer', targetId: '19195550147',
      details: { changes: { name: { old: 'Old', new: 'New' } } }, createdAt: '2026-11-23T12:00:00Z',
    });
    assert.deepEqual(queries[1].params, [50, 100]);
    assert.match(queries[1].sql, /ORDER BY created_at DESC, id DESC/);
    assert.doesNotMatch(queries[1].sql, /WHERE/i);
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('supervisor audit API lists events and records exports with actor identity', async () => {
  const originalQuery = db.query;
  const insertedEvents = [];
  db.query = async (sql, params = []) => {
    if (sql.includes('FROM applications WHERE status = ?')) {
      return [[{
        profile_id: 'profile-1',
        phone: '19195550147',
        name: 'Customer One',
        email: 'customer@example.com',
        status: params[0],
      }]];
    }
    if (sql.includes('COUNT(*) AS total FROM audit_logs')) return [[{ total: 1 }]];
    if (sql.includes('FROM audit_logs')) {
      return [[{
        id: 9,
        actorId: 4,
        actorName: 'Casey Supervisor',
        actorRole: 'supervisor',
        action: 'customer_profile_viewed',
        targetType: 'customer',
        targetId: '19195550147',
        details: { page: 1 },
        createdAt: new Date('2026-09-28T12:00:00Z'),
      }]];
    }
    if (sql.includes('INSERT INTO audit_logs')) {
      insertedEvents.push({ sql, params });
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/supervisor/audit-logs`;
  const supervisorToken = signSupervisorToken({ id: 4, name: 'Casey Supervisor' });

  try {
    const listResponse = await fetch(base, { headers: { Authorization: `Bearer ${supervisorToken}` } });
    const listBody = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listBody.logs[0].action, 'customer_profile_viewed');
    assert.equal(listBody.pagination.total, 1);

    const forbiddenResponse = await fetch(base, {
      headers: { Authorization: `Bearer ${signBasicUserToken({ id: 12 })}` },
    });
    assert.equal(forbiddenResponse.status, 403);

    const exportResponse = await fetch(`${base.replace('/supervisor/audit-logs', '/review/applications')}?status=approved&export=xlsx`, {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert.equal(exportResponse.status, 200);
    assert.equal(insertedEvents.length, 1);
    assert.equal(insertedEvents[0].params[0], 4);
    assert.equal(insertedEvents[0].params[1], 'Casey Supervisor');
    assert.equal(insertedEvents[0].params[3], 'customer_data_exported');
    assert.deepEqual(JSON.parse(insertedEvents[0].params[6]), {
      format: 'xlsx', recordCount: 1, filterFields: ['status'],
    });
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});