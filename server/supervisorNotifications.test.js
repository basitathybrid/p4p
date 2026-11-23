const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'supervisor-notifications-test-secret';
const db = require('./db');
const { app } = require('./index');
const { signSupervisorToken, signCustomerToken, signBasicUserToken } = require('./auth');
const { verifySignupOtp } = require('./signupService');
const { listNotifications } = require('./notificationService');

test('verified sign-ups and supervisor notifications commit together, and failures roll back', async () => {
  const originalConnection = db.getConnection;
  const originalQuery = db.query;
  const calls = [];
  let failNotification = false;
  let resultCode = 'OK';
  const conn = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    query: async (sql, params) => {
      if (sql.includes('CALL sp_verify_otp')) { calls.push('verify'); return [[]]; }
      if (sql.includes('@p_result_code AS result_code')) return [[{ result_code: resultCode, attempts: 0 }]];
      if (sql.includes('UPDATE notifications')) { calls.push('supersede'); return [{}]; }
      if (sql.includes('SELECT * FROM applications')) return [[{ phone: '19195550147', status: 'pending_review' }]];
      if (sql.includes('INSERT INTO notifications')) {
        calls.push('notify');
        assert.match(sql, /FROM supervisors WHERE is_active = 1/);
        assert.match(sql, /SELECT 'supervisor', CAST\(id AS CHAR\)/);
        assert.equal(params[0], 'New player sign-up');
        assert.equal(params[1], 'New player sign-up is pending approval.');
        assert.match(params[2], /^signup:19195550147:/);
        assert.equal(params[3], '/supervisor?application=19195550147#pending-applications');
        assert.deepEqual(JSON.parse(params[4]), {
          kind: 'signup', phone: '19195550147', actionLabel: 'Open pending sign-ups',
        });
        if (failNotification) throw new Error('notification insert failed');
        return [{}];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  db.getConnection = async () => conn;
  db.query = async () => [[{ phone: '19195550147', status: 'pending_review' }]];
  try {
    assert.equal((await verifySignupOtp('9195550147', '123456')).success, true);
    assert.deepEqual(calls, ['begin', 'verify', 'supersede', 'notify', 'commit', 'release']);
    calls.length = 0;
    failNotification = true;
    await assert.rejects(verifySignupOtp('9195550147', '123456'), /notification insert failed/);
    assert.deepEqual(calls, ['begin', 'verify', 'supersede', 'notify', 'rollback', 'release']);
    calls.length = 0;
    resultCode = 'OTP_INVALID';
    assert.equal((await verifySignupOtp('9195550147', '000000')).success, false);
    assert.deepEqual(calls, ['begin', 'verify', 'commit', 'release']);
  } finally {
    db.getConnection = originalConnection;
    db.query = originalQuery;
  }
});

test('sign-up alerts are scoped to the authenticated supervisor', async () => {
  const originalQuery = db.query;
  const notification = {
    id: 45, title: 'New player sign-up', message: 'New player sign-up is pending approval.',
    notification_type: 'info', event_key: 'signup:19195550147:test',
    action_url: '/supervisor?application=19195550147#pending-applications',
    metadata: JSON.stringify({ kind: 'signup', phone: '19195550147', actionLabel: 'Open pending sign-ups' }),
    read_at: null, created_at: new Date(), application_status: 'pending_review',
  };
  db.query = async (sql, params) => {
    const matchesSupervisor = params[0] === 'supervisor' && params[1] === '7';
    if (sql.includes('COUNT(*) AS count')) return [[{ count: matchesSupervisor ? 1 : 0 }]];
    if (sql.includes('FROM notifications n')) return [matchesSupervisor ? [notification] : []];
    if (sql.includes('UPDATE notifications SET read_at')) {
      return [{ affectedRows: params[0] === 45 && params[1] === 'supervisor' && params[2] === '7' ? 1 : 0 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/notifications`;
  const headers = (token) => ({ Authorization: `Bearer ${token}` });
  const supervisor = signSupervisorToken({ id: 7 });
  try {
    const response = await fetch(base, { headers: headers(supervisor) });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.unreadCount, 1);
    assert.equal(body.notifications[0].message, 'New player sign-up is pending approval.');
    assert.equal(body.notifications[0].metadata.approvalStatus, 'pending_review');
    assert.equal(body.notifications[0].metadata.actionLabel, 'Open pending sign-ups');
    assert.equal(body.notifications[0].actionUrl, notification.action_url);

    for (const token of [signCustomerToken('19195550147'), signBasicUserToken({ id: 7 }), signSupervisorToken({ id: 8 })]) {
      const other = await fetch(base, { headers: headers(token) });
      assert.deepEqual((await other.json()).notifications, []);
      assert.equal((await fetch(`${base}/45/read`, { method: 'PATCH', headers: headers(token) })).status, 404);
    }
    assert.equal((await fetch(`${base}/45/read`, { method: 'PATCH', headers: headers(supervisor) })).status, 200);
  } finally {
    db.query = originalQuery;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('notification list reports current and superseded sign-up status and scopes recipients', async () => {
  const originalQuery = db.query;
  db.query = async (sql, params) => {
    assert.deepEqual(params, ['supervisor', '7', 'supervisor', '7', 30]);
    assert.match(sql, /n.recipient_role = \? AND n.recipient_id = \?/);
    assert.match(sql, /LEFT JOIN applications/);
    return [[
      { id: 1, metadata: JSON.stringify({ kind: 'signup', phone: '1' }), application_status: 'approved' },
      { id: 2, metadata: JSON.stringify({ kind: 'signup', phone: '1', superseded: true }), application_status: 'pending_review' },
      { id: 3, metadata: JSON.stringify({ kind: 'signup', phone: '2' }), application_status: null },
      { id: 4, metadata: JSON.stringify({ kind: 'signup', phone: '3' }), application_status: 'rejected' },
      { id: 5, metadata: JSON.stringify({ kind: 'signup', phone: '4' }), application_status: 'pending_review', read_at: '2026-11-23 12:00:00' },
    ]];
  };
  try {
    const notifications = await listNotifications('supervisor', 7);
    assert.deepEqual(notifications.map((item) => item.metadata.approvalStatus), ['approved', 'superseded', 'unavailable', 'rejected', 'pending_review']);
    assert.ok(notifications[4].readAt);
  } finally {
    db.query = originalQuery;
  }
});

test('mission changes notify active supervisors transactionally and reject other roles', async () => {
  const originalConnection = db.getConnection;
  const calls = [];
  let failNotification = false;
  let existingStatus = 'Active';
  const mission = { id: 3, title: 'Daily play', description: 'Complete 1 transactions', mission_type: 'Transaction Count', target: 1, reward_points: 10, status: 'Inactive', icon: 'spark', tone: 'blue' };
  const conn = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    query: async (sql, params) => {
      if (sql.includes('FOR UPDATE')) return [[{ id: 3, status: existingStatus }]];
      if (sql.includes('UPDATE daily_missions')) { calls.push('update'); return [{}]; }
      if (sql.includes('FROM daily_missions')) return [[mission]];
      if (sql.includes('INSERT INTO notifications')) {
        calls.push('notify');
        assert.match(sql, /FROM supervisors WHERE is_active = 1/);
        assert.match(sql, /SELECT 'supervisor', CAST\(id AS CHAR\)/);
        assert.equal(params[0], 'Daily Mission settings updated');
        assert.match(params[1], /Daily Mission: Daily play.*Maria/);
        assert.match(params[2], /^mission-settings:/);
        assert.equal(params[3], '/supervisor/missions');
        assert.deepEqual(JSON.parse(params[4]), {
          kind: 'mission_settings', section: 'Daily Mission', actor: 'Maria', missionId: 3, actionLabel: 'View updated settings',
        });
        if (failNotification) throw new Error('notification insert failed');
        return [{}];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  db.getConnection = async () => conn;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/supervisor/missions/3/status`;
  const request = (token) => fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'Inactive' }),
  });

  const token = signSupervisorToken({ id: 7, name: 'Maria' });
  try {
    for (const unauthorized of [signCustomerToken('19195550147'), signBasicUserToken({ id: 1 })]) {
      assert.equal((await request(unauthorized)).status, 403);
    }
    assert.deepEqual(calls, []);
    assert.equal((await request(token)).status, 200);
    assert.deepEqual(calls, ['begin', 'update', 'notify', 'commit', 'release']);
    calls.length = 0;
    existingStatus = 'Inactive';
    assert.equal((await request(token)).status, 200);
    assert.deepEqual(calls, ['begin', 'update', 'commit', 'release']);
    calls.length = 0;
    existingStatus = 'Active';
    failNotification = true;
    const originalError = console.error;
    console.error = () => {};
    try { assert.equal((await request(token)).status, 500); } finally { console.error = originalError; }
    assert.deepEqual(calls, ['begin', 'update', 'notify', 'rollback', 'release']);
  } finally {
    db.getConnection = originalConnection;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('creating and editing missions alerts supervisors only when settings change', async () => {
  const originalConnection = db.getConnection;
  const mission = { id: 3, title: 'Daily play', description: 'Complete 1 transactions', mission_type: 'Transaction Count', target: 1, reward_points: 10, status: 'Active', icon: 'spark', tone: 'blue' };
  const notices = [];
  const conn = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes('FOR UPDATE')) return [[{ ...mission }]];
      if (sql.includes('INSERT INTO daily_missions')) return [{ insertId: 3 }];
      if (sql.includes('UPDATE daily_missions')) {
        Object.assign(mission, { title: params[0], description: params[1], mission_type: params[2], target: params[3], reward_points: params[4], status: params[5] });
        return [{}];
      }
      if (sql.includes('FROM daily_missions')) return [[{ ...mission }]];
      if (sql.includes('INSERT INTO notifications')) { notices.push(params); return [{}]; }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  db.getConnection = async () => conn;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/supervisor/missions`;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${signSupervisorToken({ id: 7, name: 'Maria' })}` };
  const payload = { title: 'Daily play', missionType: 'Transaction Count', target: 1, rewardPoints: 10, status: 'Active' };
  const request = (url, method, body) => fetch(url, { method, headers, body: JSON.stringify(body) });
  try {
    assert.equal((await request(base, 'POST', payload)).status, 201);
    assert.match(notices[0][1], /created.*Maria/);
    assert.equal(notices[0][3], '/supervisor/missions');
    assert.equal(JSON.parse(notices[0][4]).actionLabel, 'View updated settings');
    assert.equal((await request(`${base}/3`, 'PUT', payload)).status, 200);
    assert.equal(notices.length, 1);
    assert.equal((await request(`${base}/3`, 'PUT', { ...payload, rewardPoints: 20 })).status, 200);
    assert.equal(notices.length, 2);
    assert.match(notices[1][1], /updated.*Maria/);
    assert.notEqual(notices[0][2], notices[1][2]);
  } finally {
    db.getConnection = originalConnection;
    await new Promise((resolve) => server.close(resolve));
  }
});
