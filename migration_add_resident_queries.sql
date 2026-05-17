-- ============================================================
-- Migration: Add Resident Query / Complaint Management
-- Run this against your existing VPM database
-- ============================================================

CREATE TABLE IF NOT EXISTS resident_queries (
  id               INT          NOT NULL AUTO_INCREMENT,
  resident_id      INT          NOT NULL,
  title            VARCHAR(255) NOT NULL,
  description      TEXT         NOT NULL,
  category         VARCHAR(100) NOT NULL,
  apartment_number VARCHAR(50)  NOT NULL,
  priority         ENUM('LOW','MEDIUM','HIGH')                        NOT NULL DEFAULT 'MEDIUM',
  status           ENUM('PENDING','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'PENDING',
  admin_remarks    TEXT                                               DEFAULT NULL,
  image_url        VARCHAR(500)                                       DEFAULT NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at      DATETIME                                           DEFAULT NULL,

  PRIMARY KEY (id),
  CONSTRAINT fk_rq_resident
    FOREIGN KEY (resident_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- Indexes for common query patterns
  INDEX idx_rq_resident   (resident_id),
  INDEX idx_rq_status     (status),
  INDEX idx_rq_priority   (priority),
  INDEX idx_rq_created    (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Verify
-- ============================================================
SELECT 'resident_queries table created successfully' AS result;
