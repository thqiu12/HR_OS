-- Files attached to performance reviews (self-assessment, manager-assessment)
CREATE TABLE review_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id TEXT NOT NULL,
  file_kind TEXT NOT NULL,        -- 'self' (述職書) | 'manager' (上司評価書)
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL
);

CREATE INDEX idx_review_files_review ON review_files(review_id);
