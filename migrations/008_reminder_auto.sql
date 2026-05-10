-- Auto-generated reminders. Seeded reminders keep dedup_key NULL.
ALTER TABLE reminders ADD COLUMN dedup_key TEXT;
ALTER TABLE reminders ADD COLUMN auto_generated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reminders ADD COLUMN target_type TEXT;
ALTER TABLE reminders ADD COLUMN target_id TEXT;
ALTER TABLE reminders ADD COLUMN generated_at TEXT;

CREATE UNIQUE INDEX idx_reminders_dedup ON reminders(dedup_key) WHERE dedup_key IS NOT NULL;

-- Track when the last regeneration ran, for monitoring
CREATE TABLE reminder_generator_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at TEXT NOT NULL,
  ran_by TEXT,                   -- user_id or 'cron'
  generated_count INTEGER NOT NULL,
  removed_count INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL
);
