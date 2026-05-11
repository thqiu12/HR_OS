-- Phase 2: 月次給与計算
--
-- payroll_periods : 月単位の集計セッション (open → locked → exported)
-- payroll_lines   : 社員 × 賃率種別の行 (賞与/手当も将来追加可能)

CREATE TABLE payroll_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month TEXT NOT NULL UNIQUE,     -- 'YYYY-MM'
  status TEXT NOT NULL DEFAULT 'open', -- 'open'|'locked'|'exported'
  total_amount INTEGER,                 -- 確定後集計
  total_employees INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL,
  locked_at TEXT,
  locked_by TEXT,
  exported_at TEXT,
  exported_by TEXT
);
CREATE INDEX idx_payroll_periods_status ON payroll_periods(status);

CREATE TABLE payroll_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL,
  employee_id TEXT NOT NULL,
  rate_type_id INTEGER NOT NULL,
  rate_amount_snapshot INTEGER NOT NULL,
  rate_unit TEXT NOT NULL,             -- 'hour' | 'class' | 'day' | 'fixed'
  hours REAL NOT NULL DEFAULT 0,
  classes INTEGER NOT NULL DEFAULT 0,
  amount INTEGER NOT NULL,             -- 円
  shift_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_payroll_lines_period ON payroll_lines(period_id);
CREATE INDEX idx_payroll_lines_emp ON payroll_lines(employee_id, period_id);
