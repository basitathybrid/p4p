const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'customer-notifications-test-secret';
const db = require('./db');
const { app } = require('./index');
const { signCustomerToken, signSupervisorToken } = require('./auth');
const { awardCompletedMissions } = require('./missionService');
const { createTierChangeNotification } = require('./notificationService');

test('mission progress emits customer-scoped reminders and completion alerts at the required thresholds', async () => {
  const missions = [1, 2, 3].map((id) => ({
    id, title: `Mission ${id}`, mission_type: 'Transaction Count', target: 10, reward_points: 10,
  }));
  let completed = [];
  const inserts = [];
  const conn = {
    async query(sql, params) {
      if (sql.includes('FROM daily_missions')) return [missions];
      if (sql.includes('SELECT mission_id FROM customer_points_ledger')) return [completed.map((id) => ({ mission_id: id }))];
      if (sql.includes('INSERT INTO notifications')) {
        inserts.push(params);
        return [{ insertId: inserts.length }];
      }
      if (sql.includes('SELECT * FROM notifications')) return [[{ id: params[0] }]];
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const activity = { today: '2026-11-23', transactionCount: 0, loginDates: [], lastMissionAwards: new Map() };
  const phone = '19195550147';
  for (const ids of [[], [1], [1, 2], [1, 2, 3]]) {
    completed = ids;
    await awardCompletedMissions(conn, phone, activity, { notify: true });
  }
  assert.equal(inserts.length, 3);
  for (const [index, remaining] of [2, 1, 0].entries()) {
    const values = inserts[index];
    assert.equal(values[0], 'customer');
    assert.equal(values[1], phone);
    assert.equal(values[6], '/customer/missions');
    assert.equal(JSON.parse(values[7]).remainingMissions, remaining);
    assert.match(values[5], new RegExp(`^daily-reward:${phone}:2026-11-23:`));
  }
  assert.equal(inserts[2][2], 'Daily reward credited');
});

test('tier changes address the correct customer and link to their tier details', async () => {
  let inserted;
  const conn = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO notifications')) { inserted = params; return [{ insertId: 1 }]; }
      if (sql.includes('SELECT * FROM notifications')) return [[{ id: 1 }]];
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  await createTierChangeNotification({
    connection: conn, phone: '19195550147', previousTier: 'Bronze', newTier: 'Silver', effectiveDate: '2026-11-23',
  });
  assert.deepEqual(inserted.slice(0, 3), ['customer', '19195550147', 'Tier upgraded']);
  assert.equal(inserted[6], '/customer');
  assert.equal(JSON.parse(inserted[7]).newTier, 'Silver');
  inserted = undefined;
  assert.equal(await createTierChangeNotification({ connection: conn, phone: '19195550147', previousTier: 'Silver', newTier: 'Silver' }), null);
  assert.equal(inserted, undefined);
});

test('notification API reads and updates only the authenticated customer recipient', async () => {
  const originalQuery = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('COUNT(*) AS count')) return [[{ count: 0 }]];
    if (sql.includes('FROM notifications n')) return [[]];
    if (sql.includes('UPDATE notifications')) return [{ affectedRows: 0 }];
    throw new Error(`Unexpected query: ${sql}`);
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/notifications`;
  const headers = { Authorization: `Bearer ${signCustomerToken('19195550147')}` };
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers })).status, 200);
    assert.deepEqual(calls[0].params, ['customer', '19195550147', 30]);
    assert.deepEqual(calls[1].params, ['customer', '19195550147']);
    assert.equal((await fetch(`${url}/8/read`, { method: 'PATCH', headers })).status, 404);
    assert.deepEqual(calls[2].params, [8, 'customer', '19195550147']);
    assert.equal((await fetch(`${url}/8/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${signSupervisorToken({ id: 7 })}` } })).status, 404);
    assert.deepEqual(calls[3].params, [8, 'supervisor', '7']);
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});
