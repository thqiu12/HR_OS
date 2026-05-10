CREATE TABLE interviews (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  round TEXT NOT NULL,                 -- '一次面接' | '二次面接' | '最終面接' | '実技試験'
  scheduled_at TEXT NOT NULL,          -- ISO 8601
  duration_min INTEGER NOT NULL DEFAULT 60,
  format TEXT NOT NULL,                -- 'online' | 'offline'
  location TEXT,                       -- room name OR meet URL
  interviewer_names TEXT,              -- comma-separated for simplicity
  status TEXT NOT NULL,                -- 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  result TEXT,                         -- 'pass' | 'fail' | 'hold' | NULL
  feedback TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX idx_interviews_scheduled ON interviews(scheduled_at);
CREATE INDEX idx_interviews_status ON interviews(status);
