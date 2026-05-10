-- Session revocation tracking. NextAuth uses stateless JWT, so we maintain a
-- "revoked-after" timestamp per user. Any token issued before this timestamp
-- is rejected at the auth() boundary.
CREATE TABLE session_revocations (
  user_id TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL,
  revoked_by TEXT,
  reason TEXT
);
