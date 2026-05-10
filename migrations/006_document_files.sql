-- Files uploaded by candidates (via invite portal) and HR (via case detail).
-- Encrypted at rest with AES-256-GCM. The encryption metadata (iv, tag) is
-- stored alongside the ciphertext path so we can decrypt on download.
CREATE TABLE document_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL,
  doc_code TEXT NOT NULL,
  storage_key TEXT NOT NULL,           -- relative path under uploads/
  original_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,                -- of plaintext, for tamper detection
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT,                    -- session user_id, or 'invite:<jti>'
  iv TEXT NOT NULL,                    -- base64url, 12 bytes
  auth_tag TEXT NOT NULL               -- base64url, 16 bytes
);

CREATE INDEX idx_doc_files_case ON document_files(case_id);
CREATE INDEX idx_doc_files_doc ON document_files(case_id, doc_code);
