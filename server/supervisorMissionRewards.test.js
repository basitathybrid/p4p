const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'supervisor-mission-rewards-test-secret';
const db = require('./db');
const { app } = require('./index');
const { signBasicUserToken, signCustomerToken, signSupervisorToken } = require('./auth');

test('mission reward history is supervisor-only, paginated and scoped to the customer', async () => {
  const originalQuery = db.query;
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('FROM applications')) return params[0] === '19195550147' ? [[{ phone: params[0] }]] : [[]];
    if (sql.includes('COUNT(*) AS total')) return [[{ total: 26 }]];
    if (sql.includes('JOIN daily_missions')) {
      return [[{
        id: 1, points: 1000, activityDate: '2026-11-15', awardedAt: '2026-11-15T12:00:00Z',
        missionTitle: 'Power Player', usesCurrentMissionTitle: 0,
      }, {
        id: 2, points: 50, activityDate: '2026-11-14', awardedAt: '2026-11-14T12:00:00Z',
        missionTitle: 'Current title', usesCurrentMissionTitle: 1,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/supervisor/customers`;
  const supervisor = signSupervisorToken({ id: 1 });
  try {
    const url = `${base}/9195550147/mission-rewards?page=2`;
    assert.equal((await fetch(url)).status, 401);
    for (const token of [signBasicUserToken({ id: 2 }), signCustomerToken('19195550147')]) {
      assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).status, 403);
    }
    assert.equal(queries.length, 0);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${supervisor}` } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.pagination, { page: 2, pageSize: 25, pageCount: 2, total: 26 });
    assert.equal(body.rewards[0].description, 'Daily Mission Reward - Power Player');
    assert.equal(body.rewards[0].points, 1000);
    assert.equal(body.rewards[0].usesCurrentMissionTitle, false);
    assert.equal(body.rewards[1].usesCurrentMissionTitle, true);
    assert.match(queries[2].sql, /COALESCE\(ledger\.mission_title, mission\.title\)/);
    assert.deepEqual(queries[2].params, ['19195550147', 25, 25]);
    assert.deepEqual(queries[1].params, ['19195550147']);

    const missing = await fetch(`${base}/19195550999/mission-rewards`, {
      headers: { Authorization: `Bearer ${supervisor}` },
    });
    assert.equal(missing.status, 404);
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('mission reward history surfaces database errors', async () => {
  const originalQuery = db.query;
  const originalError = console.error;
  db.query = async () => { throw new Error('database unavailable'); };
  console.error = () => {};
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/supervisor/customers/19195550147/mission-rewards`, {
      headers: { Authorization: `Bearer ${signSupervisorToken({ id: 1 })}` },
    });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).message, 'Unable to load mission rewards.');
  } finally {
    db.query = originalQuery;
    console.error = originalError;
    await new Promise((resolve) => server.close(resolve));
  }
});
