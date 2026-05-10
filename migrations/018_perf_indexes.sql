-- Composite indexes to eliminate "USE TEMP B-TREE FOR ORDER BY" on hot reads.

-- reviews: query is WHERE employee_id = ? ORDER BY due_date
-- Drop the simpler single-col index in favor of the composite (covers both)
DROP INDEX IF EXISTS idx_reviews_emp;
CREATE INDEX idx_reviews_emp_due ON reviews(employee_id, due_date);

-- review_items: WHERE review_id = ? ORDER BY category, ord
DROP INDEX IF EXISTS idx_review_items_review;
CREATE INDEX idx_review_items_review_order ON review_items(review_id, category, ord);

-- review_workflow_events: WHERE review_id = ? ORDER BY ts
DROP INDEX IF EXISTS idx_review_events_review;
CREATE INDEX idx_review_events_review_ts ON review_workflow_events(review_id, ts);

-- audit_logs: filtering by user + action + time range is common for incident reviews
CREATE INDEX IF NOT EXISTS idx_audit_user_ts ON audit_logs(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_ts ON audit_logs(action, ts DESC);

-- candidates: pipeline view filters by stage + applied_at descending
CREATE INDEX IF NOT EXISTS idx_candidates_stage_applied ON candidates(stage, applied_at DESC);
