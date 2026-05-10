-- Per-user TOTP secret. NULL totp_secret = 2FA disabled.
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled_at TEXT;
