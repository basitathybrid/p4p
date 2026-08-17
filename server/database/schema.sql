-- Run once against your p4p_db database to create the tables backing the signup flow.

CREATE TABLE IF NOT EXISTS signup_sessions (
  phone            VARCHAR(20) PRIMARY KEY,
  profile_id       VARCHAR(64) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  player_mobile_id VARCHAR(64) DEFAULT '',
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

-- Account credentials for phone+password login (P1-FR-014). Created once OTP verification succeeds.
CREATE TABLE IF NOT EXISTS customers (
  phone         VARCHAR(20) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_customers_application FOREIGN KEY (phone) REFERENCES applications(phone)
);

