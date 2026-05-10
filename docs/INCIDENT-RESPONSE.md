# インシデント対応 Playbook

## 重大度 (Severity)

| Sev | 定義 | 一次対応SLA | 連絡先 |
|---|---|---|---|
| **S0** | サービス全停止 / 全社員影響 / PII大量流出 | 即時 (15分) | 緊急連絡網 + 経営層 |
| **S1** | 主機能停止 / 一部学校影響 / PII少量流出疑 | 1時間 | 担当HR + IT |
| **S2** | 1機能停止 / バグ起因 | 1営業日 | IT |
| **S3** | UIバグ / 文言誤り | 1週間 | IT |

## 共通: 初動

1. **検知**
   - 自動: Sentry アラート / `/api/health` 503 / UptimeRobot
   - 手動: ユーザー報告 → IT 一次受け
2. **記録開始**
   - インシデントチャンネル作成 (Slack #inc-YYMMDD)
   - 開始時刻 / 検知方法 / 初期症状を記載
3. **トリアージ**
   - Sev を判定
   - Sev0/1 ならば即 経営層へ第一報
4. **対応開始** (下記 Playbook 参照)
5. **収束後** Postmortem 24時間以内に作成

---

## Playbook A: ログイン障害 (全員ログインできない)

### 確認
```bash
curl -s https://YOUR-DOMAIN/api/health | jq
sqlite3 /data/hr-os.db "SELECT COUNT(*) FROM users;"
fly logs --tail | grep -i "auth\|error"
```

### 原因切り分け
| 兆候 | 原因 | 対処 |
|---|---|---|
| /api/health → db.ok=false | DB破損 or ロック | DBファイル整合性確認 → 復元 |
| auth.login.rate_limited 多発 | 攻撃 / 内部スクリプト暴走 | IP発信元特定 → middleware で一時ブロック |
| AUTH_SECRET 変更直後 | 全JWT無効化 | 元のSECRETに戻す or 全員再ログインを案内 |
| 502 / Cannot connect | プロセス落ち | `fly machines list` → restart |

---

## Playbook B: PII漏洩疑い

### 即時アクション (5分以内)
1. `audit_logs` で `employee.pii.decrypt` を直近24h で集計
   ```sql
   SELECT user_login, COUNT(*), MAX(ts)
   FROM audit_logs
   WHERE action = 'employee.pii.decrypt' AND ts > datetime('now', '-1 day')
   GROUP BY user_login ORDER BY 2 DESC;
   ```
2. 不審なユーザーのセッション即時失効
   ```sql
   INSERT OR REPLACE INTO session_revocations (user_id, revoked_at, revoked_by, reason)
   VALUES ('<user_id>', datetime('now'), 'incident', 'pii_leak_suspect');
   ```
3. 該当ユーザーの2FA強制有効化 + パスワードリセット

### 影響評価
- 復号された人数 / フィールド種別 (myNumber/bank/passport) を `audit_logs.after_value` から抽出
- 漏洩規模 ≥ 5名 → 個人情報保護委員会への報告義務 (法的)

### 鍵ローテーション
全PII を新鍵で再暗号化:
```bash
OLD_ENCRYPTION_KEY=<current> NEW_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  npm run rotate:keys
# 完了後 .env の ENCRYPTION_KEY を新値に更新 → 再デプロイ
```

---

## Playbook C: ディスクフル / アップロード失敗

### 確認
```bash
df -h /data
du -sh /data/uploads/ /data/hr-os.db*
```

### 対処
1. 古い暗号化アップロードファイルを retention に従って削除
   ```bash
   curl -X POST https://YOUR-DOMAIN/api/cron/retention -H "Authorization: Bearer $CRON_SECRET"
   ```
2. それでも不足: ボリューム拡張 (`fly volumes extend ...`)

---

## Playbook D: メール送信不能

### 確認
```sql
SELECT status, COUNT(*) FROM email_logs WHERE ts > datetime('now', '-1 hour') GROUP BY status;
```

| status | 意味 | 対処 |
|---|---|---|
| `bounced` 多発 | 送信元IPブラックリスト入り | Resend サポートへ連絡 |
| `console` のみ | RESEND_API_KEY 未設定 / 失効 | env 確認 → 再設定 |
| 全てなし | sendEmail 呼び出し自体ない | アプリログ確認 |

---

## Playbook E: 監査ログ整合性違反

`設定 / 監査ログ / 整合性検証` で違反検出時:

### これは攻撃の兆候
- アプリ層からは UPDATE/DELETE 不可 (SQLiteトリガでブロック)
- 違反 = 誰かが直接DBファイル編集 / SQLインジェクション成功

### 対応
1. **即時**: アプリを停止 (新たな書き込みを止める)
2. 違反行を audit_logs から抽出 → 影響範囲を確認
3. 直前のバックアップから復元
4. アクセスログ (sshd / fly ssh) を全件レビュー
5. 全admin パスワード強制リセット + 鍵ローテーション
6. 経営層 / 法務へエスカレーション

---

## 連絡網テンプレート

```
件名: [HR OS S0/S1/S2/S3] <症状を1行>
発生時刻: 2026-XX-XX HH:MM JST
影響範囲: <学校/法人/全社>
影響人数: 約 N 名
現状: <検知/対応中/復旧/原因調査中/解決>
ETA: <復旧見込み時刻 or 不明>
担当: <名前 + 連絡先>
チャンネル: #inc-YYMMDD
```
