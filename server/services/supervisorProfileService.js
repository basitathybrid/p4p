const db = require('../db');

function mapSupervisor(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.full_name,
    username: row.username,
    email: row.email,
    role: row.role,
    profileImageKey: row.profile_image_key,
  };
}

async function getSupervisorProfile(supervisorId) {
  const [rows] = await db.query(
    `SELECT id, full_name, username, email, role, profile_image_key
     FROM supervisors
     WHERE id = ? AND is_active = 1
     LIMIT 1`,
    [supervisorId],
  );

  return mapSupervisor(rows[0]);
}

async function setSupervisorProfileImage(supervisorId, profileImageKey) {
  const [result] = await db.query(
    'UPDATE supervisors SET profile_image_key = ? WHERE id = ? AND is_active = 1',
    [profileImageKey, supervisorId],
  );

  return result.affectedRows > 0;
}

module.exports = {
  getSupervisorProfile,
  setSupervisorProfileImage,
};