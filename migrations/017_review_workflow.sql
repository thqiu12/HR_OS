-- Performance review workflow + structured evaluation columns.
--
-- The legacy reviews table stays for backward compat. We extend it with
-- explicit workflow_status, category weights, and final scoring. New per-item
-- scoring lives in review_items. Workflow transitions are audited in
-- review_workflow_events for incident replay and process analytics.

ALTER TABLE reviews ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'draft';
-- workflow_status enum: draft / goal_setting / mid_review / self_eval /
--   first_eval / second_eval / calibration / feedback / finalized / cancelled

ALTER TABLE reviews ADD COLUMN category_weights TEXT;        -- JSON: {"performance":60,"competency":30,"behavior":10}
ALTER TABLE reviews ADD COLUMN computed_score REAL;          -- weighted average across categories (1.0–5.0)
ALTER TABLE reviews ADD COLUMN computed_rank TEXT;           -- D / C / B / A / A+ / S — pre-calibration
ALTER TABLE reviews ADD COLUMN calibrated_rank TEXT;         -- final rank after committee adjustment
ALTER TABLE reviews ADD COLUMN second_evaluator TEXT;        -- 二次評価者名
ALTER TABLE reviews ADD COLUMN started_at TEXT;
ALTER TABLE reviews ADD COLUMN finalized_at TEXT;
ALTER TABLE reviews ADD COLUMN cancelled_reason TEXT;
ALTER TABLE reviews ADD COLUMN feedback_meeting_at TEXT;     -- フィードバック面談 実施日時
ALTER TABLE reviews ADD COLUMN mid_review_notes TEXT;        -- 中間面談メモ

-- Per-item evaluation rows. One review has many items across 3 categories.
CREATE TABLE review_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id TEXT NOT NULL,
  category TEXT NOT NULL,        -- 'performance' | 'competency' | 'behavior'
  item_key TEXT NOT NULL,        -- e.g. 'goal_1', 'expertise', 'teamwork'
  title TEXT NOT NULL,
  description TEXT,
  weight_pct REAL,               -- only meaningful for performance category (MBO goals)
  target TEXT,                   -- target value/criterion (定量 or 定性)
  -- Self assessment
  self_actual TEXT,              -- self-reported achievement (% or qualitative)
  self_score INTEGER,            -- self 5-step rating (1-5), nullable
  self_comment TEXT,
  -- Manager (1次) assessment
  mgr_actual TEXT,
  mgr_score INTEGER,             -- manager 5-step rating (1-5)
  mgr_comment TEXT,
  -- Second-line review
  second_score INTEGER,
  second_comment TEXT,
  -- Final
  final_score INTEGER,
  ord INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_review_items_review ON review_items(review_id);

-- Workflow transition audit (separate from audit_logs for analytics queries)
CREATE TABLE review_workflow_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id TEXT,
  actor_name TEXT,
  note TEXT,
  ts TEXT NOT NULL
);
CREATE INDEX idx_review_events_review ON review_workflow_events(review_id);
CREATE INDEX idx_review_events_ts ON review_workflow_events(ts DESC);
