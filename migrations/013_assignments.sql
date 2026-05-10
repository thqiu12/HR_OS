-- Multi-assignment support. The existing employees columns continue to act as
-- the primary assignment for backward compatibility; this table holds ALL
-- assignments (primary + 兼任). The primary row in employee_assignments mirrors
-- employees.school_id / department_id / position / cost_ratio so we have a
-- single source of truth going forward.
CREATE TABLE employee_assignments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  position TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  assignment_type TEXT NOT NULL,     -- '所属' | '兼任' | '出向'
  cost_ratio INTEGER NOT NULL,       -- 0-100
  manager_employee_id TEXT,
  evaluator_employee_id TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_assignments_emp ON employee_assignments(employee_id);
CREATE INDEX idx_assignments_school ON employee_assignments(school_id);
CREATE INDEX idx_assignments_dept ON employee_assignments(department_id);

-- Backfill: one assignment per existing employee = their current primary
INSERT INTO employee_assignments
  (id, employee_id, school_id, department_id, position, is_primary,
   assignment_type, cost_ratio, manager_employee_id, evaluator_employee_id, start_date)
SELECT
  'asg_' || lower(hex(randomblob(6))),
  id, school_id, department_id, position,
  is_primary, assignment_type, cost_ratio,
  manager_id, evaluator_id, hire_date
FROM employees;
