# Runbook — Production Operations

## 起動 / 停止

```bash
# 開発
npm run dev

# 本番ビルド + 起動
npm run build
npm run start
```

依存:
- Node 18+ (better-sqlite3 のネイティブビルド対応)
- ファイルシステム書き込み可 (uploads/, hr-os.db)
- 環境変数: AUTH_SECRET, ENCRYPTION_KEY, AUTH_TRUST_HOST, CRON_SECRET (本番では起動時に検証)

## ヘルスチェック

```
GET /api/health
```

返却例:
```json
{
  "ok": true,
  "ts": "2026-05-10T12:34:56Z",
  "version": "0.1.0",
  "checks": {
    "db": {"ok": true, "detail": {"schools": 4}},
    "uploads": {"ok": true},
    "disk": {"ok": true, "detail": {"freeMB": 5430}}
  }
}
```

503 が返るとき:
- `db.ok=false` → DBファイルが破損 / FSロック → 再起動
- `uploads.ok=false` → ディスクフル or パーミッション → `df -h` / `ls -la uploads/`
- `disk.detail.freeMB < 100` → ディスククリーンアップ

## バックアップ / 復旧

### Litestream (推奨)
```bash
litestream replicate -config scripts/litestream.yml
```
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` を環境変数で設定。

### 手動スナップショット
```bash
./scripts/backup.sh /backups
```
hourly cron 推奨。30日経過分は自動削除。

### 復旧
```bash
# 1. アプリ停止
# 2. DB ファイルを差し替え
gunzip -c /backups/hr-os.20260510T120000Z.db.gz > /data/hr-os.db
# 3. アプリ起動
# 4. /api/health で確認
# 5. /settings/audit/verify でハッシュチェーン整合性確認
```

## Cron ジョブ

3つの cron エンドポイントを Bearer 認証 (`CRON_SECRET`) で保護:

| パス | 推奨頻度 | 内容 |
|---|---|---|
| `/api/cron/reminders` | 1時間ごと | 在留カード期限 / 試用期間終了 等のリマインダー再生成 |
| `/api/cron/retention` | 1日1回 03:00 | 不採用候補者の匿名化・削除、退職社員のPII消去 |
| `/api/cron/email-digest` | 1日1回 08:00 | 担当者別の未対応リマインダーをメール通知 |

例 (Fly.io scheduled-machine):
```toml
[[scheduled_machines]]
schedule = "0 * * * *"
command = "curl -X POST https://hr-os.fly.dev/api/cron/reminders -H 'Authorization: Bearer $CRON_SECRET'"
```

## 障害対応 Playbook

### 全ユーザーがログインできない
1. `/api/health` 確認 → DB 異常か?
2. audit_logs 確認: `auth.login.rate_limited` が増えていないか? IP偽装されているか?
3. `AUTH_SECRET` が変わっていないか確認 (変わると全 JWT が無効化)

### 特定ユーザーのセッションを即時失効
```sql
INSERT OR REPLACE INTO session_revocations (user_id, revoked_at, revoked_by, reason)
VALUES ('<user_id>', datetime('now'), 'admin', 'incident-response');
```
または `/settings/users` の「セッション失効」ボタン。

### 監査ログ整合性違反
1. `/settings/audit/verify` で違反行を特定
2. **DB を直接編集している兆候** — 即時調査
3. アプリ層からの編集はできない (SQLite トリガでブロック) → 攻撃者がDBファイル直接編集 or インジェクション

### PII漏洩疑い
1. `audit_logs` で `employee.pii.decrypt` を時系列で確認
2. 不審な大量復号 → 該当ユーザーセッション失効 + 2FA強制
3. 必要に応じて `scripts/rotate-pii-key.ts` で鍵ローテーション

## デプロイ

### Fly.io
```bash
fly deploy
fly logs --tail
fly ssh console -C "ls /data"
```

### ロールバック
```bash
fly releases
fly releases rollback <version>
```

### マイグレーション
- 起動時に `lib/migrations.ts` が自動実行 (`migrations/*.sql` を順次)
- 適用済み: `schema_migrations` テーブル
- 失敗時: アプリ起動エラー → ログ確認 → 該当 .sql 修正 → 再デプロイ

## アラート設定

`AI_MONTHLY_BUDGET_USD` + `BUDGET_ALERT_EMAIL` で `scripts/check-api-budget.ts` を1日1回実行 (Fly cron推奨)。
80% / 100% でメール通知。

Sentry設定時: エラー率、レイテンシ、リリース連携で常時監視。
