CREATE TABLE user_preferences (
  user_id TEXT NOT NULL,
  pref_key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, pref_key)
);
