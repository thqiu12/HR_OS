-- Extend invite_tokens to support both onboarding (existing) and teacher
-- portal (new). Teacher portal is a no-login URL where part-time/full-time
-- staff view their shifts and payslips.

ALTER TABLE invite_tokens ADD COLUMN kind TEXT NOT NULL DEFAULT 'onboarding';
-- kind: 'onboarding' | 'teacher_portal'
ALTER TABLE invite_tokens ADD COLUMN employee_id TEXT;
-- For teacher_portal: which employee this URL grants access to.
-- onboarding tokens already have case_id which points to onboarding_cases.

CREATE INDEX idx_invite_tokens_kind ON invite_tokens(kind);
CREATE INDEX idx_invite_tokens_employee ON invite_tokens(employee_id);
