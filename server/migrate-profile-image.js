const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '.env'),
  path.resolve(__dirname, '..', '.env'),
]

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
  }
}

const db = require('./db');

async function migrateProfileImageColumn() {
  let exitCode = 0;

  try {
    await db.query(
      'ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS profile_image_key VARCHAR(512);',
    );

    const [rows] = await db.query(
      `SELECT COUNT(*) AS column_count
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'supervisors'
         AND column_name = 'profile_image_key'`,
    );

    if (Number(rows[0]?.column_count) !== 1) {
      throw new Error('Verification failed: supervisors.profile_image_key was not found.');
    }

    console.log('Migration successful: supervisors.profile_image_key exists.');
  } catch (error) {
    exitCode = 1;
    console.error('Migration failed:', error.message);
  } finally {
    await db.end();
  }

  process.exitCode = exitCode;
}

migrateProfileImageColumn();