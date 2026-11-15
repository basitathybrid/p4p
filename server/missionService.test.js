const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateLoginStreak,
  getCustomerMissionActivity,
  getMissionProgress,
  awardCompletedMissions,
} = require('./missionService');

test('login streak counts consecutive days through today or yesterday', () => {
  assert.equal(calculateLoginStreak(['2026-11-12', '2026-11-11', '2026-11-10'], '2026-11-12'), 3);
  assert.equal(calculateLoginStreak(['2026-11-11', '2026-11-10'], '2026-11-12'), 2);
  assert.equal(calculateLoginStreak(['2026-11-09'], '2026-11-12'), 0);
});

test('mission awards are only inserted when the corresponding target is reached', async () => {
  const awards = [];
  const conn = {
    async query(sql, params) {
      if (sql.includes('FROM daily_missions')) {
        return [[
          { id: 1, title: 'Transactions', mission_type: 'Transaction Count', target: 3, reward_points: 250 },
          { id: 2, title: 'Streak', mission_type: 'Login Streak', target: 2, reward_points: 100 },
          { id: 3, title: 'More transactions', mission_type: 'Transaction Count', target: 10, reward_points: 500 },
        ]];
      }
      if (sql.includes('INSERT IGNORE INTO customer_points_ledger')) {
        awards.push(params);
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };

  await awardCompletedMissions(conn, '19195550147', {
    today: '2026-11-12',
    transactionCount: 3,
    loginDates: ['2026-11-12', '2026-11-11'],
    lastMissionAwards: new Map(),
  });

  assert.deepEqual(awards, [
    ['19195550147', 1, 250, '2026-11-12', 'Transactions'],
    ['19195550147', 2, 100, '2026-11-12', 'Streak'],
  ]);
});

test('streak cycles award once on the final login day and restart independently', async () => {
  const missions = [
    { id: 1, mission_type: 'Login Streak', target: 3, reward_points: 50 },
    { id: 2, mission_type: 'Login Streak', target: 2, reward_points: 20 },
  ];
  const loginDates = [];
  const awards = [];
  let today;
  const conn = {
    async query(sql, params) {
      if (sql.includes('DATE_FORMAT(CURRENT_DATE()')) return [[{ today }]];
      if (sql.includes('SELECT COUNT(*) AS transaction_count')) return [[{ transaction_count: 0 }]];
      if (sql.includes('FROM customer_login_days')) return [loginDates.map((date) => ({ activity_date: date }))];
      if (sql.includes('FROM customer_points_ledger')) {
        return [missions.flatMap((mission) => {
          const previousDates = awards
            .filter((award) => award.missionId === mission.id && award.date < today)
            .map((award) => award.date).sort();
          return previousDates.length ? [{ mission_id: mission.id, last_award_date: previousDates.at(-1) }] : [];
        })];
      }
      if (sql.includes('FROM daily_missions')) return [missions];
      if (sql.includes('INSERT IGNORE INTO customer_points_ledger')) {
        const [, missionId, points, date] = params;
        if (!awards.some((award) => award.missionId === missionId && award.date === date)) {
          awards.push({ missionId, points, date });
        }
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  async function check(date, login, expected) {
    today = date;
    if (login && !loginDates.includes(date)) loginDates.push(date);
    const activity = await getCustomerMissionActivity(conn, 'customer');
    assert.deepEqual(missions.map((mission) => getMissionProgress(mission, activity)), expected);
    await awardCompletedMissions(conn, 'customer', activity);
  }

  await check('2026-11-01', true, [1, 1]);
  await check('2026-11-01', true, [1, 1]);
  await check('2026-11-02', true, [2, 2]);
  await check('2026-11-03', true, [3, 1]);
  await check('2026-11-03', true, [3, 1]);
  await check('2026-11-04', false, [0, 1]);
  await check('2026-11-04', true, [1, 2]);
  await check('2026-11-05', true, [2, 1]);
  await check('2026-11-06', true, [3, 2]);

  assert.deepEqual(awards, [
    { missionId: 2, points: 20, date: '2026-11-02' },
    { missionId: 1, points: 50, date: '2026-11-03' },
    { missionId: 2, points: 20, date: '2026-11-04' },
    { missionId: 1, points: 50, date: '2026-11-06' },
    { missionId: 2, points: 20, date: '2026-11-06' },
  ]);
  assert.equal(awards.reduce((sum, award) => sum + award.points, 0), 160);
});

test('a missed day breaks mission progress and yesterday alone cannot trigger an award', async () => {
  const mission = { id: 1, mission_type: 'Login Streak', target: 2, reward_points: 50 };
  const awards = [];
  const conn = {
    async query(sql, params) {
      if (sql.includes('FROM daily_missions')) return [[mission]];
      if (sql.includes('INSERT IGNORE INTO customer_points_ledger')) {
        awards.push(params);
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  const activity = {
    today: '2026-11-03',
    transactionCount: 0,
    loginDates: ['2026-11-01', '2026-11-02'],
    lastMissionAwards: new Map(),
  };
  assert.equal(getMissionProgress(mission, activity), 2);
  await awardCompletedMissions(conn, 'customer', activity);
  assert.deepEqual(awards, []);

  activity.today = '2026-11-04';
  assert.equal(getMissionProgress(mission, activity), 0);
  activity.loginDates.push('2026-11-04');
  assert.equal(getMissionProgress(mission, activity), 1);
});

test('a one-day mission starts a new cycle only after its award date', () => {
  const mission = { id: 1, mission_type: 'Login Streak', target: 1 };
  const activity = {
    today: '2026-11-02',
    loginDates: ['2026-11-01'],
    lastMissionAwards: new Map([['1', '2026-11-01']]),
  };
  assert.equal(getMissionProgress(mission, activity), 0);
  activity.loginDates.push('2026-11-02');
  assert.equal(getMissionProgress(mission, activity), 1);
});
