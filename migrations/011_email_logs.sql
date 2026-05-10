CREATE TABLE email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  recipients TEXT NOT NULL,
  subject TEXT NOT NULL,
  tag TEXT,
  provider TEXT NOT NULL,        -- 'resend' | 'console'
  status TEXT NOT NULL,          -- 'sent' | 'console' | 'error'
  message_id TEXT,
  error TEXT
);

CREATE INDEX idx_email_logs_ts ON email_logs(ts DESC);
CREATE INDEX idx_email_logs_tag ON email_logs(tag);
