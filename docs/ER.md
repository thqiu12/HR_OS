# データベース ER 図

## 全体構成

```mermaid
erDiagram
    schools ||--o{ departments : has
    schools ||--o{ employees : employs
    departments ||--o{ employees : assigned_to
    schools ||--o{ jobs : posts
    departments ||--o{ jobs : posts
    jobs ||--o{ candidates : receives
    schools ||--o{ onboarding_cases : hosts
    onboarding_cases ||--o{ onboarding_documents : requires
    onboarding_cases ||--o{ invite_tokens : generates
    employees ||--o{ reviews : evaluated_by
    employees ||--o| users : "linked via employee_id"
    users ||--o{ user_roles : has
    schools ||--o{ reminders : about
    employees ||--o{ employees : "managed by manager_id"

    schools {
        TEXT id PK
        TEXT name
        TEXT type "jls/senmon/juku/hq"
        TEXT entity "法人名"
    }

    departments {
        TEXT id PK
        TEXT school_id FK
        TEXT name
    }

    employees {
        TEXT id PK
        TEXT emp_no
        TEXT name
        TEXT kana
        TEXT romaji
        TEXT nationality
        TEXT email
        TEXT school_id FK
        TEXT department_id FK
        TEXT position
        TEXT hire_route "新卒/中途"
        TEXT hire_date
        TEXT probation_end
        TEXT zairyu_expiry
        TEXT status
        TEXT manager_id FK
        TEXT evaluator_id FK
        INT  is_primary
        INT  cost_ratio
        TEXT my_number_enc "AES-256-GCM"
        TEXT bank_account_enc "AES-256-GCM"
        TEXT passport_no_enc "AES-256-GCM"
    }

    jobs {
        TEXT id PK
        TEXT title
        TEXT school_id FK
        TEXT department_id FK
        TEXT route
        TEXT status
        INT  open_count
        TEXT posted_at
    }

    candidates {
        TEXT id PK
        TEXT name
        TEXT kana
        TEXT nationality
        TEXT jlpt
        TEXT job_id FK
        TEXT stage "応募/書類選考/.../入社済"
        INT  attachments
        TEXT email
        TEXT phone
        INT  age
        TEXT experience
        TEXT source
    }

    onboarding_cases {
        TEXT id PK
        TEXT candidate_name
        TEXT school_id FK
        TEXT position
        TEXT route
        TEXT expected_join_date
        TEXT status
    }

    onboarding_documents {
        INT  id PK
        TEXT case_id FK
        TEXT doc_code
        TEXT doc_name
        INT  required
        TEXT status "未提出/提出済/確認中/差戻し/完了"
        TEXT reject_reason
        INT  ord
    }

    invite_tokens {
        TEXT jti PK "JWT JTI"
        TEXT case_id FK
        TEXT issued_by
        TEXT issued_at
        TEXT expires_at "30d default"
        TEXT revoked_at
        TEXT last_used_at
    }

    reviews {
        TEXT id PK
        TEXT employee_id FK
        TEXT type "試用期間/年度/昇格/給与改定"
        TEXT period_label
        TEXT due_date
        TEXT rating "S/A+/A/B/C/D"
        TEXT result
        TEXT evaluator
        TEXT status
    }

    reminders {
        TEXT id PK
        TEXT category
        TEXT severity "info/warn/critical"
        TEXT title
        TEXT detail
        TEXT trigger_date
        TEXT school_id FK
    }

    users {
        TEXT id PK
        TEXT login_id UK
        TEXT email
        TEXT name
        TEXT password_hash "bcrypt"
        TEXT employee_id FK
    }

    user_roles {
        INT  id PK
        TEXT user_id FK
        TEXT role "group_admin/entity_hr/school_hr/principal/manager/employee"
        TEXT scope_type "group/entity/school/department"
        TEXT scope_id
    }

    audit_logs {
        INT  id PK
        TEXT ts
        TEXT user_id
        TEXT user_login
        TEXT action
        TEXT resource_type
        TEXT resource_id
        TEXT before_value
        TEXT after_value
        TEXT ip
        TEXT user_agent
        TEXT reason
        TEXT prev_hash "SHA-256 chain"
        TEXT row_hash "SHA-256 chain"
    }

    rate_limit_buckets {
        TEXT bucket_key PK
        INT  window_start PK
        INT  count
    }

    schema_migrations {
        TEXT version PK
        TEXT applied_at
    }
```

## 主要な制約・特徴

### 兼任サポート（Multi-assignment）
`employees` テーブルは現状、主所属の１レコードのみ持つシンプルな構造。本番運用で完全な兼任を扱う場合、`employee_assignments` 中間テーブルへの分離を推奨：

```mermaid
erDiagram
    employees ||--o{ employee_assignments : has
    schools ||--o{ employee_assignments : at
    departments ||--o{ employee_assignments : in

    employee_assignments {
        INT  id PK
        TEXT employee_id FK
        TEXT school_id FK
        TEXT department_id FK
        TEXT position_id FK
        INT  is_primary
        TEXT assignment_type "所属/兼任/出向"
        INT  cost_ratio "0-100"
        TEXT manager_employee_id FK
        TEXT evaluator_employee_id FK
        TEXT start_date
        TEXT end_date
    }
```

### PII 暗号化
- `employees.my_number_enc` / `bank_account_enc` / `passport_no_enc`：すべて **AES-256-GCM** 暗号化
- 形式：`base64url(IV).base64url(authTag).base64url(ciphertext)`
- 鍵導出：`scrypt(ENCRYPTION_KEY, "hr-os-pii-v1", 32)`
- 平文は DB に残さない

### 監査ログのハッシュチェーン
- `audit_logs.prev_hash` + `row_hash` で改ざん検出
- `row_hash = SHA-256(行内容 + 前行の row_hash)`
- SQLiteトリガー `audit_logs_no_update` / `audit_logs_no_delete` が物理的に UPDATE/DELETE を阻止
- 整合性検証 UI：`/settings/audit/verify`

### スコープ管理（RBAC）
- `user_roles.scope_type`：`group` / `entity` / `school` / `department`
- 1ユーザーが複数ロール × 複数スコープを持てる
  - 例：「校長 @ s1」+「部門長 @ d1」
- フィルタは `lib/permissions.ts` で実装

### マイグレーション
- すべてのスキーマ変更は `migrations/NNN_*.sql` に集約
- 適用済みバージョンは `schema_migrations` で追跡
- 起動時に未適用のものをトランザクション内で順次適用
