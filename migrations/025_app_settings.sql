-- Key-value store for app-wide settings (group name, display labels, etc.).
-- Distinct from user_preferences (per-user) and env vars (per-deploy/secret).
-- Values are kept as TEXT; callers JSON-encode/decode as needed.

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);

-- Seed the top-level organization (group) display name. Falls back to a
-- placeholder if never customised. UI reads via db.getAppSetting('group_name').
INSERT OR IGNORE INTO app_settings (setting_key, value, updated_at)
VALUES ('group_name', '当グループ', datetime('now'));
