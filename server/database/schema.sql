-- Run once against your p4p_db database to create the tables backing the signup flow.

CREATE TABLE IF NOT EXISTS signup_sessions (
  phone            VARCHAR(20) PRIMARY KEY,
  profile_id       VARCHAR(64) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  player_mobile_id VARCHAR(64) DEFAULT '',
  player_id       BIGINT UNSIGNED NULL,
  facebook         VARCHAR(255) DEFAULT '',
  instagram        VARCHAR(255) DEFAULT '',
  telegram         VARCHAR(255) DEFAULT '',
  password_hash    VARCHAR(255) NOT NULL,
  otp_code         VARCHAR(6) NOT NULL,
  otp_created_at   DATETIME NOT NULL,
  attempts         INT NOT NULL DEFAULT 0,
  locked_until     DATETIME NULL,
  status           ENUM('otp_pending', 'verified', 'locked') NOT NULL DEFAULT 'otp_pending',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  phone            VARCHAR(20) PRIMARY KEY,
  profile_id       VARCHAR(64) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  player_mobile_id VARCHAR(64) DEFAULT '',
  player_id       BIGINT UNSIGNED NULL,
  facebook         VARCHAR(255) DEFAULT '',
  instagram        VARCHAR(255) DEFAULT '',
  telegram         VARCHAR(255) DEFAULT '',
  status           ENUM('pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'pending_review',
  submitted_at     DATETIME NOT NULL,
  reviewed_at      DATETIME NULL,
  review_decision  ENUM('approved', 'rejected') NULL,
  review_reviewer  VARCHAR(255) NULL,
  INDEX idx_applications_status (status)
);

SET @signup_player_id_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'signup_sessions' AND column_name = 'player_id'
);
SET @signup_player_id_sql = IF(@signup_player_id_exists = 0,
  'ALTER TABLE signup_sessions ADD COLUMN player_id BIGINT UNSIGNED NULL AFTER player_mobile_id',
  'SELECT 1'
);
PREPARE signup_player_id_stmt FROM @signup_player_id_sql;
EXECUTE signup_player_id_stmt;
DEALLOCATE PREPARE signup_player_id_stmt;

SET @application_player_id_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'applications' AND column_name = 'player_id'
);
SET @application_player_id_sql = IF(@application_player_id_exists = 0,
  'ALTER TABLE applications ADD COLUMN player_id BIGINT UNSIGNED NULL AFTER player_mobile_id',
  'SELECT 1'
);
PREPARE application_player_id_stmt FROM @application_player_id_sql;
EXECUTE application_player_id_stmt;
DEALLOCATE PREPARE application_player_id_stmt;

-- Account credentials for phone+password login (P1-FR-014). Created once OTP verification succeeds.
CREATE TABLE IF NOT EXISTS customers (
  phone         VARCHAR(20) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_application FOREIGN KEY (phone) REFERENCES applications(phone)
);

CREATE TABLE IF NOT EXISTS supervisors (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name     VARCHAR(255) NOT NULL,
  username      VARCHAR(100) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL DEFAULT 'supervisor',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO supervisors (full_name, username, email, password_hash, role, is_active)
VALUES (
  'Maria Rodriguez',
  'maria.rodriguez',
  'supervisor@payfe.com',
  '$2b$10$yF5dDiBRQDa7N2qLPC9y.uyXWpIbOU4klzbY53mT.0y4mI4wekD3C',
  'supervisor',
  1
)
ON DUPLICATE KEY UPDATE
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  is_active = VALUES(is_active);

