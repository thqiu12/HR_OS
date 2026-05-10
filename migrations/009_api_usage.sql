-- Anthropic API usage tracking. One row per API call.
CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  model TEXT NOT NULL,
  feature TEXT NOT NULL,         -- 'resume_parse' / 'future...'
  user_id TEXT,
  user_login TEXT,
  resource_type TEXT,
  resource_id TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  status TEXT NOT NULL,          -- 'success' / 'error' / 'mock'
  error TEXT
);

CREATE INDEX idx_api_usage_ts ON api_usage(ts DESC);
CREATE INDEX idx_api_usage_model ON api_usage(model);
CREATE INDEX idx_api_usage_user ON api_usage(user_id);
