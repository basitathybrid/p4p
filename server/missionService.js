const db = require('./db');

function dateOffset(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calculateLoginStreak(activityDates, today, afterDate = null) {
  const recordedDates = new Set(activityDates);
  let expectedDate = recordedDates.has(today) ? today : dateOffset(today, -1);
  if (!recordedDates.has(expectedDate)) return 0;

  let streak = 0;
  while (recordedDates.has(expectedDate) && (!afterDate || expectedDate > afterDate)) {
    streak += 1;
    expectedDate = dateOffset(expectedDate, -1);
  }
  return streak;
}

async function getCustomerMissionActivity(conn, phone) {
  const [dateRows] = await conn.query(
    'SELECT DATE_FORMAT(CURRENT_DATE(), "%Y-%m-%d") AS today',
  );
  const today = dateRows[0].today;
  const [transactionRows] = await conn.query(
    `SELECT COUNT(*) AS transaction_count
     FROM transactions
     WHERE phone = ?
       AND LOWER(TRIM(transaction_status)) = 'completed'
       AND transaction_datetime >= ?
       AND transaction_datetime < DATE_ADD(?, INTERVAL 1 DAY)`,
    [phone, today, today],
  );
  const [loginRows] = await conn.query(
    `SELECT DATE_FORMAT(activity_date, "%Y-%m-%d") AS activity_date
     FROM customer_login_days
     WHERE phone = ? AND activity_date >= DATE_SUB(?, INTERVAL 100 YEAR)
     ORDER BY activity_date DESC`,
    [phone, today],
  );
  const [awardRows] = await conn.query(
    `SELECT mission_id, DATE_FORMAT(MAX(activity_date), "%Y-%m-%d") AS last_award_date
     FROM customer_points_ledger
     WHERE phone = ? AND activity_date < ?
     GROUP BY mission_id`,
    [phone, today],
  );
  const loginDates = loginRows.map((row) => row.activity_date);

  return {
    today,
    transactionCount: Number(transactionRows[0]?.transaction_count || 0),
    loginDates,
    loginStreak: calculateLoginStreak(loginDates, today),
    lastMissionAwards: new Map(awardRows.map((row) => [String(row.mission_id), row.last_award_date])),
  };
}

function getMissionProgress(mission, activity) {
  if (mission.mission_type !== 'Login Streak') return activity.transactionCount;
  return calculateLoginStreak(
    activity.loginDates,
    activity.today,
    activity.lastMissionAwards.get(String(mission.id)),
  );
}

async function awardCompletedMissions(conn, phone, activity) {
  const [missions] = await conn.query(
    `SELECT id, title, mission_type, target, reward_points
     FROM daily_missions WHERE status = 'Active'`,
  );

  for (const mission of missions) {
    const progress = getMissionProgress(mission, activity);
    if (progress < Number(mission.target)) continue;
    if (mission.mission_type === 'Login Streak' && !activity.loginDates.includes(activity.today)) continue;

    await conn.query(
      `INSERT IGNORE INTO customer_points_ledger
         (phone, mission_id, points, activity_date, mission_title)
       VALUES (?, ?, ?, ?, ?)`,
      [phone, mission.id, mission.reward_points, activity.today, mission.title],
    );
  }
}

async function recordCustomerLogin(phone) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'INSERT IGNORE INTO customer_login_days (phone, activity_date) VALUES (?, CURRENT_DATE())',
      [phone],
    );
    const activity = await getCustomerMissionActivity(conn, phone);
    await awardCompletedMissions(conn, phone, activity);
    await conn.commit();
    return activity;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function refreshCustomerMissionAwards(phone) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const activity = await getCustomerMissionActivity(conn, phone);
    await awardCompletedMissions(conn, phone, activity);
    await conn.commit();
    return activity;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  calculateLoginStreak,
  getMissionProgress,
  getCustomerMissionActivity,
  awardCompletedMissions,
  recordCustomerLogin,
  refreshCustomerMissionAwards,
};
