# Security Policy

## Reporting a vulnerability

メール: security@your-domain.com (PGP: <fingerprint>)

公開しない範囲:
- 該当バージョン
- 再現手順
- 影響範囲

返信SLA: 営業日 2 日以内に受領通知、7 日以内に三angeメント。

## Security model overview

### 認証
- NextAuth v5 (JWT セッション、HttpOnly + Secure + SameSite=Strict クッキー)
- パスワード: bcrypt (cost factor 10)
- 2FA: TOTP (RFC 6238) 任意有効化
- SSO: Google / Microsoft Entra ID (事前プロビジョニング必須)
- レート制限: per-IP (30/分) + per-IP+ID (5/分)
- IP アロウリスト: ロール毎に環境変数で設定可

### 認可
- ロール: group_admin / entity_hr / school_hr / principal / manager / employee / executive / auditor
- スコープ: group / entity / school / department
- 各 server action は `auth()` → `hasRole`/`canSee*`/`canEdit*` → `filter*` の3段チェック

### データ保護
- PII (マイナンバー / 銀行口座 / パスポート番号): AES-256-GCM 暗号化
  - 鍵は `ENCRYPTION_KEY` (フォールバック `AUTH_SECRET`)
  - 鍵ローテーション: `scripts/rotate-pii-key.ts`
- アップロード書類 (履歴書 / 入社書類): AES-256-GCM 暗号化、IV/タグはDB、暗号文はFS
- 監査ログ: SHA-256 ハッシュチェーン + SQLite トリガで UPDATE/DELETE 物理ブロック

### 通信
- HTTPS 強制 (HSTS 2年、includeSubDomains, preload)
- CSP: default-src 'self' 等で XSS 影響範囲を制限
- X-Frame-Options DENY (clickjacking 防止)
- CSRF: middleware で Origin == Host を検証

### 監査・追跡
- 認証 (success/failed/rate_limited/ip_blocked) → audit_logs
- PII 暗号化/復号 → audit_logs
- 全データ書き換え (CRUD/移動/承認) → audit_logs
- ハッシュチェーン整合性検証 UI: `/settings/audit/verify`

### 個人情報の保持と削除
- 不採用候補者: 90日後 PII匿名化 / 365日後 完全削除
- 退職社員: 5年後 PII (マイナンバー等) 削除、社員レコードは保持
- 削除請求: `softDeleteEmployeeAction` で即時 PII 消去 + セッション失効
- 開示請求: `exportEmployeeDataAction` でJSON エクスポート
- cron: `/api/cron/retention` (1日1回推奨)

## Known limitations

- SQLite 単一ファイル: ~100同時接続が上限。それ以上は Postgres / Turso 移行。
- Anthropic API への履歴書送信: ANTHROPIC_API_KEY を設定する場合、PII が外部送信される旨を雇用契約に明記が必要。
