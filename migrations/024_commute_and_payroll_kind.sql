-- 交通費 (commute) settings + payroll line kind for non-wage rows.
--
-- commute_mode:
--   'none'         未設定
--   'commute_pass' 月額固定 (定期券代として支給)
--   'per_diem'     日額 × 出勤日数 (異なる日付ごと)
--   'per_shift'    シフト毎 (シフト数 × 単価)
-- commute_amount: yen — 単位は mode による
-- commute_taxable: 0 = 非課税 (15万円/月以内), 1 = 課税対象として扱う

ALTER TABLE employees ADD COLUMN commute_mode TEXT NOT NULL DEFAULT 'none';
ALTER TABLE employees ADD COLUMN commute_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN commute_taxable INTEGER NOT NULL DEFAULT 0;

-- payroll_lines kind:
--   'wage'    本給 (rate_type 別) ← 既存
--   'commute' 通勤手当
--   'bonus'   賞与 (将来)
--   'allowance' 各種手当 (将来)
ALTER TABLE payroll_lines ADD COLUMN kind TEXT NOT NULL DEFAULT 'wage';
ALTER TABLE payroll_lines ADD COLUMN taxable INTEGER NOT NULL DEFAULT 1;
-- 0 = 非課税, 1 = 課税

CREATE INDEX idx_payroll_lines_kind ON payroll_lines(period_id, kind);
