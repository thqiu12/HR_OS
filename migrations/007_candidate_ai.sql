-- AI-parsed resume data + candidate file uploads (resume PDFs, etc.)
ALTER TABLE candidates ADD COLUMN ai_parsed_at TEXT;
ALTER TABLE candidates ADD COLUMN ai_parsed_data TEXT;   -- JSON: {education, career, qualifications, summary, jlpt, ...}
ALTER TABLE candidates ADD COLUMN ai_parse_model TEXT;
ALTER TABLE candidates ADD COLUMN ai_parse_status TEXT;  -- pending / done / error / skipped(no_key)

CREATE TABLE candidate_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  is_resume INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_candidate_files_cand ON candidate_files(candidate_id);
