-- AES-256-GCM encrypted PII columns. Format: base64url(iv).base64url(tag).base64url(ciphertext)
ALTER TABLE employees ADD COLUMN my_number_enc TEXT;
ALTER TABLE employees ADD COLUMN bank_account_enc TEXT;
ALTER TABLE employees ADD COLUMN passport_no_enc TEXT;

CREATE INDEX idx_employees_pii_present ON employees(id) WHERE my_number_enc IS NOT NULL;
