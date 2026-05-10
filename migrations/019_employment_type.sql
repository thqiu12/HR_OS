-- Phase 1: introduce employment_type so the system can distinguish
-- regular / contract / part_time / gyomu_itaku staff. This is the foundation
-- for future shift management + payroll automation (Phase 2).
--
-- Defaults to 'regular' so existing rows keep their current behavior.

ALTER TABLE employees ADD COLUMN employment_type TEXT NOT NULL DEFAULT 'regular';
-- Allowed values: regular | contract | part_time | gyomu_itaku

-- Wage fields used only for non-monthly employees (part_time / gyomu_itaku)
ALTER TABLE employees ADD COLUMN hourly_rate INTEGER;          -- 時給 (yen)
ALTER TABLE employees ADD COLUMN per_class_rate INTEGER;       -- コマ給 (yen)

-- Contract management for fixed-term staff (contract / part_time / gyomu_itaku)
ALTER TABLE employees ADD COLUMN contract_renewal_date TEXT;   -- 次回更新予定日

CREATE INDEX idx_employees_employment_type ON employees(employment_type);
