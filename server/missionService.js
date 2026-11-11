const db = require('./db');

function dateOffset(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calculateLoginStreak(activityDates, today) {
  const recordedDates = new Set(activityDates);
  let expectedDate = recordedDates.has(today) ? today : dateOffset(today, -1);
  if (!recordedDates.has(expectedDate)) return 0;

  let streak = 0;
  while (recordedDates.has(expectedDate)) {
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
       AND transaction_datetime >= CURRENT_DATE()
       AND transaction_datetime < DATE_ADD(CURRENT_DATE(), INTERVAL 1 DAY)`,
    [phone],
  );
  const [loginRows] = await conn.query(
    `SELECT DATE_FORMAT(activity_date, "%Y-%m-%d") AS activity_date
     FROM customer_login_days
     WHERE phone = ? AND activity_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 100 YEAR)
     ORDER BY activity_date DESC`,
    [phone],
  );

  return {
    today,
    transactionCount: Number(transactionRows[0]?.transaction_count || 0),
    loginStreak: calculateLoginStreak(loginRows.map((row) => row.activity_date), today),
  };
}

async function awardCompletedMissions(conn, phone, activity) {
  const [missions] = await conn.query(
    `SELECT id, mission_type, target, reward_points
     FROM daily_missions WHERE status = 'Active'`,
  );

  for (const mission of missions) {
    const progress = mission.mission_type === 'Login Streak'
      ? activity.loginStreak
      : activity.transactionCount;
    if (progress < Number(mission.target)) continue;

    await conn.query(
      `INSERT IGNORE INTO customer_points_ledger
         (phone, mission_id, points, activity_date)
       VALUES (?, ?, ?, ?)`,
      [phone, mission.id, mission.reward_points, activity.today],
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
  getCustomerMissionActivity,
  awardCompletedMissions,
  recordCustomerLogin,
  refreshCustomerMissionAwards,
};
