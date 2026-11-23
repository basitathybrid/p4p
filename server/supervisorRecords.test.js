const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'supervisor-records-test-secret';
const db = require('./db');
const { app } = require('./index');
const { signSupervisorToken, signBasicUserToken, signCustomerToken } = require('./auth');

test('supervisor records endpoints enforce access and return paginated transactions and saved tiers', async () => {
  const originalQuery = db.query;
  const queries = [];
  db.query = async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes('COUNT(*) AS total FROM transactions')) return [[{ total: 101 }]];
    if (sql.includes('FROM transactions t')) return [[{
      transactionId: 'TX-1', phone: '19195550147', playerName: 'Player One',
      type: 'buy', amount: '25.00', status: 'completed', transactionDate: '2026-11-23 12:00:00',
    }]];
    if (sql.includes('FROM tier_thresholds')) return [[
      { name: 'Bronze', minimum: '0.00' },
      { name: 'Silver', minimum: '1234.50' },
      { name: 'Gold', minimum: '9999.99' },
      { name: 'Diamond', minimum: '22000.00' },
    ]];
    throw new Error(`Unexpected query: ${sql}`);
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/supervisor`;
  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  try {
    for (const endpoint of ['transactions', 'tier-configuration']) {
      assert.equal((await fetch(`${base}/${endpoint}`)).status, 401);
      for (const token of [signCustomerToken('19195550147'), signBasicUserToken({ id: 1 })]) {
        assert.equal((await fetch(`${base}/${endpoint}`, { headers: auth(token) })).status, 403);
      }
    }
    assert.equal(queries.length, 0);
    const token = signSupervisorToken({ id: 7 });
    const response = await fetch(`${base}/transactions?page=99`, { headers: auth(token) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.pagination, { page: 3, pageSize: 50, pageCount: 3, total: 101 });
    assert.deepEqual(body.transactions[0], {
      transactionId: 'TX-1', phone: '19195550147', playerName: 'Player One',
      type: 'buy', amount: '25.00', status: 'completed', transactionDate: '2026-11-23 12:00:00',
    });
    assert.deepEqual(queries[1].params, [50, 100]);
    assert.match(queries[1].sql, /ORDER BY t\.transaction_datetime DESC, t\.transaction_id DESC/);
    const tierResponse = await fetch(`${base}/tier-configuration`, { headers: auth(token) });
    assert.equal(tierResponse.status, 200);
    assert.deepEqual((await tierResponse.json()).tiers, [
      { name: 'Bronze', minimum: '0.00' },
      { name: 'Silver', minimum: '1234.50' },
      { name: 'Gold', minimum: '9999.99' },
      { name: 'Diamond', minimum: '22000.00' },
    ]);
    assert.doesNotMatch(queries[2].sql, /\b(?:WHERE|LIMIT)\b/i);
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('supervisor records endpoints report database errors', async () => {
  const originalQuery = db.query;
  const originalError = console.error;
  db.query = async () => { throw new Error('database unavailable'); };
  console.error = () => {};
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/supervisor`;
  const headers = { Authorization: `Bearer ${signSupervisorToken({ id: 7 })}` };
  try {
    for (const [endpoint, message] of [['transactions', 'Unable to load transactions.'], ['tier-configuration', 'Unable to load tier configuration.']]) {
      const response = await fetch(`${base}/${endpoint}`, { headers });
      assert.equal(response.status, 500);
      assert.equal((await response.json()).message, message);
    }
  } finally {
    db.query = originalQuery;
    console.error = originalError;
    await new Promise((resolve) => server.close(resolve));
  }
});
