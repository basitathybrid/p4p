const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'basic-customer-filters-test-secret';

const db = require('./db');
const { app } = require('./index');
const { signBasicUserToken, signSupervisorToken } = require('./auth');

test('basic customer endpoint applies dashboard filters with bound values', async () => {
  const originalQuery = db.query;
  let capturedQuery;
  db.query = async (sql, params) => {
    capturedQuery = { sql, params };
    return [[{ phone: '19195550147', status: 'approved' }]];
  };

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = new URL(`http://127.0.0.1:${server.address().port}/api/basic/customers`);
  Object.entries({
    search: 'Ava 555-0147',
    tier: 'Gold',
    status: 'approved',
    transactionType: 'send',
    minVolume: '100',
    maxVolume: '250',
    minCount: '2',
    maxCount: '10',
    lastActivityFrom: '2026-09-01',
    lastActivityTo: '2026-09-28',
    signupFrom: '2026-01-01',
    signupTo: '2026-06-30',
  }).forEach(([key, value]) => url.searchParams.set(key, value));

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${signBasicUserToken({ id: 12 })}` },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.customers[0].status, 'approved');
    assert.match(capturedQuery.sql, /a\.name LIKE \? OR a\.phone LIKE \?/);
    assert.match(capturedQuery.sql, /EXISTS \(SELECT 1 FROM transactions t WHERE t\.phone = a\.phone AND t\.transaction_type = \?\)/);
    assert.match(capturedQuery.sql, /DATE\(u\.last_activity_at\) >= \?/);
    assert.match(capturedQuery.sql, /DATE\(a\.submitted_at\) <= \?/);
    assert.deepEqual(capturedQuery.params, [
      '%Ava 555-0147%', '%5550147%', 'Gold', 'approved', 'send',
      100, 250, 2, 10, '2026-09-01', '2026-09-28', '2026-01-01', '2026-06-30',
    ]);

    const invalidRange = await fetch(`${url.origin}/api/basic/customers?minCount=4&maxCount=2`, {
      headers: { Authorization: `Bearer ${signBasicUserToken({ id: 12 })}` },
    });
    assert.equal(invalidRange.status, 400);

    const supervisorResponse = await fetch(`${url.origin}/api/supervisor/customers?tier=Gold`, {
      headers: { Authorization: `Bearer ${signSupervisorToken({ id: 7 })}` },
    });
    assert.equal(supervisorResponse.status, 200);
    assert.deepEqual(capturedQuery.params, ['Gold']);
    assert.match(capturedQuery.sql, /a\.profile_id AS profileId/);
    assert.match(capturedQuery.sql, /a\.facebook, a\.instagram, a\.telegram/);
    assert.match(capturedQuery.sql, /a\.reviewed_at AS reviewedAt/);
    assert.match(capturedQuery.sql, /COALESCE\(u\.buy_total, 0\) AS buyTotal/);
    assert.match(capturedQuery.sql, /COALESCE\(u\.send_total, 0\) AS sendTotal/);
    assert.match(capturedQuery.sql, /COALESCE\(u\.receive_total, 0\) AS receiveTotal/);
    assert.match(capturedQuery.sql, /COALESCE\(u\.sell_total, 0\) AS sellTotal/);
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});