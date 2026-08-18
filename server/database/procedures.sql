-- Stored procedures for the signup/OTP/review flow.
-- Run this after schema.sql. Re-run safely; procedures are dropped and recreated.

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_start_signup $$
CREATE PROCEDURE sp_start_signup(
  IN p_phone VARCHAR(20),
  IN p_name VARCHAR(255),
  IN p_email VARCHAR(255),
  IN p_player_mobile_id VARCHAR(64),
  IN p_facebook VARCHAR(255),
  IN p_instagram VARCHAR(255),
  IN p_telegram VARCHAR(255),
  IN p_password_hash VARCHAR(255),
  IN p_otp_code VARCHAR(6),
  OUT p_result_code VARCHAR(32),
  OUT p_profile_id VARCHAR(64)
)
BEGIN
  DECLARE v_app_status VARCHAR(20) DEFAULT NULL;
  DECLARE v_app_profile_id VARCHAR(64) DEFAULT NULL;
  DECLARE v_session_exists INT DEFAULT 0;

  SELECT status, profile_id INTO v_app_status, v_app_profile_id
  FROM applications WHERE phone = p_phone;

  SELECT COUNT(*) INTO v_session_exists
  FROM signup_sessions WHERE phone = p_phone;

  IF v_app_status IS NOT NULL AND v_app_status <> 'rejected' THEN
    SET p_result_code = 'PHONE_EXISTS';
    SET p_profile_id = NULL;
  ELSEIF v_session_exists > 0 THEN
    SET p_result_code = 'PHONE_EXISTS';
    SET p_profile_id = NULL;
  ELSE
    SET p_profile_id = COALESCE(v_app_profile_id, CONCAT('profile-', p_phone));

    INSERT INTO signup_sessions (
      phone, profile_id, name, email, player_mobile_id,
      facebook, instagram, telegram, password_hash, otp_code, otp_created_at,
      attempts, locked_until, status
    ) VALUES (
      p_phone, p_profile_id, p_name, p_email, p_player_mobile_id,
      p_facebook, p_instagram, p_telegram, p_password_hash, p_otp_code, NOW(),
      0, NULL, 'otp_pending'
    );

    SET p_result_code = 'OK';
  END IF;
END $$

DROP PROCEDURE IF EXISTS sp_verify_otp $$
CREATE PROCEDURE sp_verify_otp(
  IN p_phone VARCHAR(20),
  IN p_otp_code VARCHAR(6),
  IN p_max_attempts INT,
  IN p_ttl_seconds INT,
  IN p_lockout_seconds INT,
  OUT p_result_code VARCHAR(32),
  OUT p_attempts INT,
  OUT p_locked TINYINT,
  OUT p_retry_after_seconds INT
)
BEGIN
  DECLARE v_otp_code VARCHAR(6);
  DECLARE v_otp_created_at DATETIME;
  DECLARE v_locked_until DATETIME;
  DECLARE v_attempts INT DEFAULT 0;
  DECLARE v_name VARCHAR(255);
  DECLARE v_email VARCHAR(255);
  DECLARE v_player_mobile_id VARCHAR(64);
  DECLARE v_facebook VARCHAR(255);
  DECLARE v_instagram VARCHAR(255);
  DECLARE v_telegram VARCHAR(255);
  DECLARE v_profile_id VARCHAR(64);
  DECLARE v_password_hash VARCHAR(255);
  DECLARE v_found INT DEFAULT 0;

  SET p_locked = 0;
  SET p_retry_after_seconds = 0;

  SELECT COUNT(*) INTO v_found FROM signup_sessions WHERE phone = p_phone;

  IF v_found = 0 THEN
    SET p_result_code = 'NO_SESSION';
    SET p_attempts = 0;
  ELSE
    SELECT otp_code, otp_created_at, locked_until, attempts,
           name, email, player_mobile_id, facebook, instagram, telegram, profile_id, password_hash
      INTO v_otp_code, v_otp_created_at, v_locked_until, v_attempts,
           v_name, v_email, v_player_mobile_id, v_facebook, v_instagram, v_telegram, v_profile_id, v_password_hash
    FROM signup_sessions WHERE phone = p_phone
    FOR UPDATE;

    IF v_locked_until IS NOT NULL AND NOW() < v_locked_until THEN
      SET p_result_code = 'LOCKED';
      SET p_locked = 1;
      SET p_attempts = v_attempts;
      SET p_retry_after_seconds = GREATEST(0, TIMESTAMPDIFF(SECOND, NOW(), v_locked_until));

    ELSEIF TIMESTAMPDIFF(SECOND, v_otp_created_at, NOW()) > p_ttl_seconds THEN
      DELETE FROM signup_sessions WHERE phone = p_phone;
      SET p_result_code = 'OTP_EXPIRED';
      SET p_attempts = v_attempts;

    ELSEIF p_otp_code <> 'TWILIO' AND v_otp_code <> p_otp_code THEN
      SET v_attempts = v_attempts + 1;

      IF v_attempts >= p_max_attempts THEN
        UPDATE signup_sessions
        SET attempts = v_attempts, locked_until = DATE_ADD(NOW(), INTERVAL p_lockout_seconds SECOND), status = 'locked'
        WHERE phone = p_phone;

        SET p_result_code = 'OTP_INVALID';
        SET p_locked = 1;
        SET p_attempts = v_attempts;
        SET p_retry_after_seconds = p_lockout_seconds;
      ELSE
        UPDATE signup_sessions SET attempts = v_attempts WHERE phone = p_phone;
        SET p_result_code = 'OTP_INVALID';
        SET p_attempts = v_attempts;
      END IF;

    ELSE
      INSERT INTO applications (
        phone, profile_id, name, email, player_mobile_id,
        facebook, instagram, telegram, status, submitted_at,
        reviewed_at, review_decision, review_reviewer
      ) VALUES (
        p_phone, v_profile_id, v_name, v_email, v_player_mobile_id,
        v_facebook, v_instagram, v_telegram, 'pending_review', NOW(),
        NULL, NULL, NULL
      )
      ON DUPLICATE KEY UPDATE
        profile_id = v_profile_id, name = v_name, email = v_email,
        player_mobile_id = v_player_mobile_id, facebook = v_facebook,
        instagram = v_instagram, telegram = v_telegram,
        status = 'pending_review', submitted_at = NOW(),
        reviewed_at = NULL, review_decision = NULL, review_reviewer = NULL;

      INSERT INTO customers (phone, password_hash)
      VALUES (p_phone, v_password_hash)
      ON DUPLICATE KEY UPDATE password_hash = v_password_hash;

      DELETE FROM signup_sessions WHERE phone = p_phone;

      SET p_result_code = 'OK';
      SET p_attempts = v_attempts;
    END IF;
  END IF;
END $$

DROP PROCEDURE IF EXISTS sp_update_application $$
CREATE PROCEDURE sp_update_application(
  IN p_phone VARCHAR(20),
  IN p_name VARCHAR(255),
  IN p_email VARCHAR(255),
  IN p_player_mobile_id VARCHAR(64),
  IN p_facebook VARCHAR(255),
  IN p_instagram VARCHAR(255),
  IN p_telegram VARCHAR(255),
  OUT p_result_code VARCHAR(32)
)
BEGIN
  DECLARE v_status VARCHAR(20) DEFAULT NULL;

  SELECT status INTO v_status FROM applications WHERE phone = p_phone FOR UPDATE;

  IF v_status IS NULL THEN
    SET p_result_code = 'NOT_FOUND';
  ELSEIF v_status <> 'pending_review' THEN
    SET p_result_code = 'REVIEW_CLOSED';
  ELSE
    UPDATE applications
    SET name = p_name, email = p_email, player_mobile_id = p_player_mobile_id,
        facebook = p_facebook, instagram = p_instagram, telegram = p_telegram
    WHERE phone = p_phone;

    SET p_result_code = 'OK';
  END IF;
END $$

DROP PROCEDURE IF EXISTS sp_decide_application $$
CREATE PROCEDURE sp_decide_application(
  IN p_phone VARCHAR(20),
  IN p_decision VARCHAR(20),
  IN p_reviewer VARCHAR(255),
  OUT p_result_code VARCHAR(32)
)
BEGIN
  DECLARE v_status VARCHAR(20) DEFAULT NULL;

  SELECT status INTO v_status FROM applications WHERE phone = p_phone FOR UPDATE;

  IF v_status IS NULL THEN
    SET p_result_code = 'NOT_FOUND';
  ELSEIF v_status <> 'pending_review' THEN
    SET p_result_code = 'REVIEW_CLOSED';
  ELSEIF p_decision NOT IN ('approved', 'rejected') THEN
    SET p_result_code = 'INVALID_DECISION';
  ELSE
    UPDATE applications
    SET status = p_decision, reviewed_at = NOW(), review_decision = p_decision, review_reviewer = p_reviewer
    WHERE phone = p_phone;

    SET p_result_code = 'OK';
  END IF;
END $$

DELIMITER ;
