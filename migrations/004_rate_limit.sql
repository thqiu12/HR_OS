-- Sliding-window rate limit counters
CREATE TABLE rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,   -- unix epoch seconds, aligned to window
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

CREATE INDEX idx_rl_window ON rate_limit_buckets(window_start);
