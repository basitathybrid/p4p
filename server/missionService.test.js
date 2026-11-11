const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateLoginStreak, awardCompletedMissions } = require('./missionService');

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
          { id: 1, mission_type: 'Transaction Count', target: 3, reward_points: 250 },
          { id: 2, mission_type: 'Login Streak', target: 2, reward_points: 100 },
          { id: 3, mission_type: 'Transaction Count', target: 10, reward_points: 500 },
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
    loginStreak: 2,
  });

  assert.deepEqual(awards, [
    ['19195550147', 1, 250, '2026-11-12'],
    ['19195550147', 2, 100, '2026-11-12'],
  ]);
});
