-- Multi-rate wage system.
--
-- Supports per-employee multiple hourly rates (授業時給 / 事務時給 / 会議時給 etc.)
-- with effective dating, so historical rate changes are preserved.
--
-- 設計方針:
--   wage_rate_types : マスタ (HRが自由に種別を追加可能)
--                     scope: group (全社) / entity (法人) / school (校別)
--   employee_wage_rates : 各社員 × 種別 × 期間 の賃率
--                          effective_to=NULL で「現在有効」
--
-- The legacy employees.hourly_rate column stays for backward compat. New
-- code should read from employee_wage_rates instead.

CREATE TABLE wage_rate_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope_type TEXT NOT NULL,          -- 'group' | 'entity' | 'school'
  scope_id TEXT,                      -- entity name OR school id; NULL for group-wide
  code TEXT NOT NULL,                 -- snake_case identifier
  name TEXT NOT NULL,                 -- 表示名 e.g. '授業時給'
  unit TEXT NOT NULL DEFAULT 'hour',  -- 'hour' | 'class' | 'day' | 'fixed'
  default_amount INTEGER,             -- 円, optional
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  notes TEXT
);
CREATE UNIQUE INDEX idx_wage_rate_types_scope_code ON wage_rate_types(scope_type, COALESCE(scope_id, ''), code);

CREATE TABLE employee_wage_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL,
  rate_type_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,            -- 円
  effective_from TEXT NOT NULL,       -- 'YYYY-MM-DD'
  effective_to TEXT,                  -- NULL = currently active
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE INDEX idx_emp_wage_rates_emp ON employee_wage_rates(employee_id, effective_from DESC);
CREATE INDEX idx_emp_wage_rates_active ON employee_wage_rates(employee_id) WHERE effective_to IS NULL;

-- Seed group-wide default rate types so a fresh DB is usable immediately.
INSERT INTO wage_rate_types (scope_type, scope_id, code, name, unit, default_amount, sort_order, created_at) VALUES
  ('group', NULL, 'teaching',   '授業時給',  'hour', 3000, 10, datetime('now')),
  ('group', NULL, 'admin',      '事務時給',  'hour', 1500, 20, datetime('now')),
  ('group', NULL, 'meeting',    '会議時給',  'hour', 1500, 30, datetime('now')),
  ('group', NULL, 'substitute', '代講時給',  'hour', 3500, 40, datetime('now')),
  ('group', NULL, 'per_class',  'コマ給',    'class', 6000, 50, datetime('now'));
