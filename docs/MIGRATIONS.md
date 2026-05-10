# Migrations Guide

## 仕組み
- すべての .sql ファイルは `migrations/` 配下に番号付きで配置 (`NNN_<name>.sql`)
- アプリ起動時に `lib/migrations.ts` が自動実行
- `schema_migrations` テーブルで適用済みを追跡 (idempotent)
- 失敗時はトランザクション内でロールバック → アプリ起動失敗

## マイグレーションを追加するとき

```bash
# 連番の次の番号で .sql 作成
ls migrations/ | tail -3
# => 016_user_2fa.sql, 017_review_workflow.sql, 018_perf_indexes.sql
# 次は 019_<name>.sql

# 必ず以下を守る:
# 1. CREATE / ALTER は IF NOT EXISTS / IF EXISTS で冪等に書く
# 2. データ修正系は WHERE で重複防止
# 3. PRAGMA foreign_keys = OFF はしない (FKを保ちつつ書く)
# 4. テーブル削除は別マイグレーション (本当に必要か熟考)
```

## ロールバック方針

SQLite に標準的な down migration はない。代わりに:

### 軽微な変更 (新カラム/新インデックス)
- ロールバックせず "前のコード" にデプロイし直す
- 新カラムは未使用カラムとして残る (害なし)
- 不要な index は次マイグレーションで `DROP INDEX` で削除

### 重大な変更 (テーブル削除/カラム rename)
1. **必ず事前にバックアップを取る**
   ```bash
   ./scripts/backup.sh /backups/pre-NNN
   ```
2. 失敗時の復旧手順 (RUNBOOK.md 参照):
   ```bash
   # アプリ停止
   gunzip -c /backups/pre-NNN/hr-os.*.db.gz > /data/hr-os.db
   # 起動
   ```
3. ロールバック対応マイグレーションを書く (例: `019_revert_<feature>.sql`)

## ドライラン

新マイグレーションを本番投入する前に:

```bash
# 本番DBのコピーで確認
cp /data/hr-os.db /tmp/dryrun.db
HR_DB_PATH=/tmp/dryrun.db npm run dev
# ログを確認:
# [migrations] applied 019_xxx
# エラーなく起動 + データに矛盾がないこと
```

## ステージング → 本番

1. develop branch でマイグレーション開発
2. CI で migrations.test.ts が通ることを確認
3. ステージング環境にデプロイ → 1日観察
4. 問題なければ本番デプロイ
5. デプロイ直後 + 翌朝 `/api/health` と `/settings/audit/verify` を確認

## マイグレーション履歴 (現在)

| # | 名前 | 概要 |
|---|---|---|
| 001 | init | 初期スキーマ (schools, departments, employees, jobs, candidates, ...) |
| 002 | pii | employees.my_number_enc, bank_account_enc, passport_no_enc |
| 003 | audit_chain | audit_logs に prev_hash, row_hash + UPDATE/DELETE トリガ |
| 004 | rate_limit | rate_limit_buckets |
| 005 | reminder_handled | reminders.handled_at, handled_by |
| 006 | document_files | onboarding 書類アップロード暗号化 |
| 007 | candidate_ai | AI 履歴書解析結果 |
| 008 | reminder_auto | リマインダー自動生成 |
| 009 | api_usage | Anthropic 使用量・コスト |
| 010 | review_files | 評価ファイルアップロード |
| 011 | email_logs | メール送信履歴 |
| 012 | interviews | 面接スケジュール |
| 013 | assignments | 兼任 (employee_assignments) |
| 014 | user_preferences | UI設定 (KPI並び順) |
| 015 | session_revocations | セッション失効 |
| 016 | user_2fa | TOTP secret |
| 017 | review_workflow | 評価8段階ワークフロー + items + events |
| 018 | perf_indexes | ORDER BY 最適化用複合インデックス |
