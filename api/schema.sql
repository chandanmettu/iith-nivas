-- Nivas — MySQL schema for Hostinger shared hosting.
-- Import once via hPanel → Databases → phpMyAdmin → Import.
--
-- Design notes:
--  * A listing is identified by (hostel, room). One room, one listing.
--  * Ownership is an email that has proved it can receive mail. Writes need a
--    token issued only after a code sent to that address was entered back.
--  * Contact details are stored always but SERVED only when share_contact = 1.
--    The read endpoint never selects email at all.
--  * Bookmarks are per device token so they work before anyone verifies.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ── Owners ────────────────────────────────────────────────────────────────
-- One row per verified email address.
CREATE TABLE IF NOT EXISTS nivas_owners (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  token_hash    CHAR(64)     NOT NULL,           -- sha256 of the owner token
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_email (email),
  KEY idx_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Email verification codes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nivas_codes (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email       VARCHAR(190) NOT NULL,
  code_hash   CHAR(64)     NOT NULL,             -- sha256 of the 6-digit code
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at  DATETIME     NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_email (email),
  KEY idx_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Listings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nivas_listings (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id        INT UNSIGNED NOT NULL,
  hostel          VARCHAR(64)  NOT NULL,
  room            VARCHAR(8)   NOT NULL,
  display_name    VARCHAR(64)  NOT NULL,
  phone           VARCHAR(24)  NOT NULL DEFAULT '',
  share_contact   TINYINT(1)   NOT NULL DEFAULT 0,  -- consent to publish name + phone
  willing_to_move TINYINT(1)   NOT NULL DEFAULT 0,
  note            VARCHAR(280) NOT NULL DEFAULT '',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_room (hostel, room),          -- one listing per physical room
  KEY idx_owner (owner_id),
  CONSTRAINT fk_listing_owner FOREIGN KEY (owner_id)
    REFERENCES nivas_owners (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Destination preferences (max 3 per listing, enforced in PHP) ──────────
CREATE TABLE IF NOT EXISTS nivas_preferences (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id  INT UNSIGNED NOT NULL,
  rank_order  TINYINT UNSIGNED NOT NULL,
  hostel      VARCHAR(64)  NOT NULL,
  pod         TINYINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_listing (listing_id),
  CONSTRAINT fk_pref_listing FOREIGN KEY (listing_id)
    REFERENCES nivas_listings (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Bookmarks ─────────────────────────────────────────────────────────────
-- Keyed by an anonymous device token so a student can save rooms before (or
-- without) verifying an email.
CREATE TABLE IF NOT EXISTS nivas_bookmarks (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_token CHAR(64)    NOT NULL,             -- sha256 of the client token
  hostel       VARCHAR(64) NOT NULL,
  room         VARCHAR(8)  NOT NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_bookmark (device_token, hostel, room),
  KEY idx_room (hostel, room)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Feedback ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nivas_feedback (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind       VARCHAR(32)  NOT NULL,
  name       VARCHAR(64)  NOT NULL,
  email      VARCHAR(190) NOT NULL,
  phone      VARCHAR(24)  NOT NULL DEFAULT '',
  hostel     VARCHAR(64)  NOT NULL DEFAULT '',
  message    TEXT         NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Abuse throttle ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nivas_rate (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket     VARCHAR(64) NOT NULL,               -- e.g. "code:1.2.3.4"
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bucket (bucket, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
