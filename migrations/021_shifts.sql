-- Phase 2: シフト管理
--
-- 設計:
--   courses              : 教科/科目マスタ (任意)
--   shift_patterns       : 週次定型 (毎週月水19:00-21:00 N1クラス)
--   shift_assignments    : 月次実績 (確定/キャンセル/振替)
--
-- 全職員 (regular/contract/part_time/gyomu_itaku) で共通利用。
-- 各 shift_assignment は wage_rate_types を介してどの賃率で計算するかを保持。

-- 1. コース/クラス master
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  level TEXT,                       -- 'N1' | 'N2' | 'N3' | 'beginner' etc.
  default_minutes INTEGER NOT NULL DEFAULT 60,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_courses_school_code ON courses(school_id, code);
CREATE INDEX idx_courses_school ON courses(school_id);

-- 2. 週次パターン (繰り返しテンプレート)
CREATE TABLE shift_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  course_id TEXT,
  rate_type_id INTEGER NOT NULL,    -- どの賃率で計算するか
  day_of_week INTEGER NOT NULL,     -- 0=日 1=月 2=火 ... 6=土
  start_time TEXT NOT NULL,         -- 'HH:MM'
  end_time TEXT NOT NULL,           -- 'HH:MM'
  effective_from TEXT NOT NULL,     -- 'YYYY-MM-DD'
  effective_to TEXT,                -- NULL = 現在有効
  notes TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);
CREATE INDEX idx_shift_patterns_emp ON shift_patterns(employee_id, day_of_week);
CREATE INDEX idx_shift_patterns_school ON shift_patterns(school_id);
CREATE INDEX idx_shift_patterns_active ON shift_patterns(employee_id) WHERE effective_to IS NULL;

-- 3. 月次シフト実績
CREATE TABLE shift_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  course_id TEXT,
  rate_type_id INTEGER NOT NULL,
  rate_amount_snapshot INTEGER NOT NULL,  -- 計算時の賃率 (遡及防止)
  rate_unit TEXT NOT NULL,          -- 'hour' | 'class' | 'day' | 'fixed'
  date TEXT NOT NULL,               -- 'YYYY-MM-DD'
  start_time TEXT NOT NULL,         -- 'HH:MM'
  end_time TEXT NOT NULL,           -- 'HH:MM'
  hours REAL NOT NULL,              -- 計算済 (end - start)
  classes INTEGER NOT NULL DEFAULT 1, -- 1コマ単位の場合
  status TEXT NOT NULL,             -- 'planned'|'confirmed'|'cancelled'|'substituted'|'completed'|'paid'
  pattern_id INTEGER,               -- 元パターン (任意)
  substitute_employee_id TEXT,      -- 代講者
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payroll_period_id INTEGER         -- 給与確定後に紐付け
);
CREATE INDEX idx_shift_assignments_emp_date ON shift_assignments(employee_id, date);
CREATE INDEX idx_shift_assignments_school_date ON shift_assignments(school_id, date);
CREATE INDEX idx_shift_assignments_status ON shift_assignments(status);
CREATE INDEX idx_shift_assignments_period ON shift_assignments(payroll_period_id);
