-- Initial schema: orgs, employees, recruiting, onboarding, performance, reminders, users/roles, audit, invite tokens

CREATE TABLE schools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  entity TEXT NOT NULL
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  emp_no TEXT NOT NULL,
  name TEXT NOT NULL,
  kana TEXT NOT NULL,
  romaji TEXT NOT NULL,
  nationality TEXT NOT NULL,
  flag TEXT NOT NULL,
  email TEXT NOT NULL,
  school_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  position TEXT NOT NULL,
  hire_route TEXT NOT NULL,
  hire_date TEXT NOT NULL,
  probation_end TEXT NOT NULL,
  contract_end TEXT,
  zairyu_expiry TEXT,
  status TEXT NOT NULL,
  manager_id TEXT,
  evaluator_id TEXT,
  is_primary INTEGER NOT NULL,
  cost_ratio INTEGER NOT NULL,
  assignment_type TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  school_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  route TEXT NOT NULL,
  status TEXT NOT NULL,
  open_count INTEGER NOT NULL,
  posted_at TEXT NOT NULL
);

CREATE TABLE candidates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kana TEXT NOT NULL,
  flag TEXT NOT NULL,
  nationality TEXT NOT NULL,
  jlpt TEXT,
  job_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  attachments INTEGER NOT NULL,
  applied_at TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  age INTEGER NOT NULL,
  experience TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE onboarding_cases (
  id TEXT PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  flag TEXT NOT NULL,
  school_id TEXT NOT NULL,
  position TEXT NOT NULL,
  route TEXT NOT NULL,
  expected_join_date TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE onboarding_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL,
  doc_code TEXT NOT NULL,
  doc_name TEXT NOT NULL,
  required INTEGER NOT NULL,
  status TEXT NOT NULL,
  reject_reason TEXT,
  ord INTEGER NOT NULL
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  type TEXT NOT NULL,
  period_label TEXT NOT NULL,
  due_date TEXT NOT NULL,
  rating TEXT,
  result TEXT NOT NULL,
  evaluator TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  trigger_date TEXT NOT NULL,
  school_id TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  login_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  employee_id TEXT
);

CREATE TABLE user_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT
);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  user_id TEXT,
  user_login TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  before_value TEXT,
  after_value TEXT,
  ip TEXT,
  user_agent TEXT,
  reason TEXT
);

CREATE TABLE invite_tokens (
  jti TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  issued_by TEXT,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_audit_ts ON audit_logs(ts DESC);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_invite_case ON invite_tokens(case_id);
CREATE INDEX idx_employees_school ON employees(school_id);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_candidates_stage ON candidates(stage);
CREATE INDEX idx_candidates_job ON candidates(job_id);
CREATE INDEX idx_docs_case ON onboarding_documents(case_id);
CREATE INDEX idx_reviews_emp ON reviews(employee_id);
