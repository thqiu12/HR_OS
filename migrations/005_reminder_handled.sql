-- Reminders can be marked handled (dismissed/done) by anyone with reminders module access
ALTER TABLE reminders ADD COLUMN handled_at TEXT;
ALTER TABLE reminders ADD COLUMN handled_by TEXT;

CREATE INDEX idx_reminders_handled ON reminders(handled_at);
