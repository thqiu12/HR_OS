# 本番デプロイガイド

このアプリは現状 **better-sqlite3 + ローカルファイル** で動いています。
デプロイ先によって取れる選択肢が変わるので、まず stack を選んでください。

---

## 選択肢の比較

| デプロイ先 | better-sqlite3 そのまま使えるか | おすすめ度 |
|---|---|---|
| **Fly.io / Railway / Render（永続ディスク付き）** | ✅ そのまま | ⭐⭐⭐ 最小変更 |
| **VPS（DigitalOcean / さくらVPS / Linode）** | ✅ そのまま | ⭐⭐⭐ 完全制御 |
| **Vercel** | ❌ FS が ephemeral | ⚠️ Turso へ移行が必要 |
| **AWS Lambda / Cloudflare Workers** | ❌ Edge runtime | ⚠️ Turso へ移行が必要 |

> **要点**：better-sqlite3 はネイティブモジュール + ファイルシステム書き込みが必要。
> Vercel は serverless で **書き込み可能なFSがない** ため、SQLite を使い続けるならファイル系の代替（Turso = libSQL）か、Postgres への移行が必要です。

---

## オプション A: Fly.io（最も簡単・SQLite 維持）

### 1. Fly CLI セットアップ
```bash
brew install flyctl
fly auth signup
fly launch --no-deploy   # fly.toml を生成
```

### 2. `fly.toml` を編集
```toml
app = "hr-os"
primary_region = "nrt"

[mounts]
  source = "hr_os_data"
  destination = "/data"

[env]
  HR_DB_PATH = "/data/hr-os.db"
  NODE_ENV = "production"

[[services]]
  protocol = "tcp"
  internal_port = 3010
  [[services.ports]]
    handlers = ["http"]
    port = 80
    force_https = true
  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

### 3. Volume を作成（SQLite データ用）
```bash
fly volumes create hr_os_data --region nrt --size 1
```

### 4. シークレット設定
```bash
fly secrets set \
  AUTH_SECRET=$(openssl rand -hex 32) \
  ENCRYPTION_KEY=$(openssl rand -hex 32) \
  AUTH_TRUST_HOST=true
```

### 5. デプロイ
```bash
fly deploy
```

完了。`fly open` でアクセス確認。

---

## オプション B: Vercel + Turso（libSQL）への移行

Vercel に乗せるには SQLite を **Turso (libSQL)** に置き換えます。
libSQL は SQLite フォーク + ネットワークプロトコル対応で、API はほぼ同じ。

### 1. Turso CLI と DB 作成
```bash
brew install tursodatabase/tap/turso
turso auth login
turso db create hr-os --location nrt
turso db tokens create hr-os --expiration none
```

### 2. パッケージ差し替え
```bash
npm uninstall better-sqlite3 @types/better-sqlite3
npm install @libsql/client
```

### 3. `lib/db.ts` のドライバー部分のみ変更
`better-sqlite3` の `Database` クラスを `@libsql/client` の `createClient` に差し替え。
クエリの書き方はほぼ同じ（`prepare`, `run`, `all`, `get`）が、**全部 async** になる点に注意。
Server Components / Server Actions は async なので問題なし。

### 4. 環境変数
```bash
# .env.production.local
TURSO_DATABASE_URL=libsql://hr-os-<user>.turso.io
TURSO_AUTH_TOKEN=<token>
AUTH_SECRET=<32byte hex>
ENCRYPTION_KEY=<32byte hex>
AUTH_TRUST_HOST=true
```

### 5. マイグレーション実行
```bash
turso db shell hr-os < migrations/001_init.sql
turso db shell hr-os < migrations/002_pii.sql
turso db shell hr-os < migrations/003_audit_chain.sql
turso db shell hr-os < migrations/004_rate_limit.sql
```

### 6. `next.config.js` から better-sqlite3 を外す
```js
experimental: { serverComponentsExternalPackages: [] }, // libSQL は不要
```

### 7. Vercel デプロイ
```bash
vercel --prod
```
Vercel ダッシュボードで上記環境変数を設定。

---

## オプション C: Postgres への移行（規模が大きい場合）

100社以上 / 数千人規模なら Postgres が無難：

1. **Neon / Supabase** で Postgres インスタンス作成
2. `drizzle-orm` + `drizzle-kit` 導入（型安全 + マイグレーション自動化）
3. `lib/db.ts` を Drizzle に書き換え
4. SQL 方言の差分を吸収（`AUTOINCREMENT` → `SERIAL` 等）

このプロジェクトでは現状未対応。必要になったら別途対応。

---

## 本番チェックリスト

デプロイ先に関わらず、以下は必須：

### シークレット
- [ ] `AUTH_SECRET`：`openssl rand -hex 32` で生成（最低 32 バイト）
- [ ] `ENCRYPTION_KEY`：`AUTH_SECRET` と**別の値**（鍵ローテーションが容易になる）
- [ ] `AUTH_TRUST_HOST=true`（プロキシ経由時）
- [ ] DB 接続文字列（Turso/Postgres の場合）
- [ ] **絶対** Git にコミットしない、CI シークレット管理ツール経由で配布

### HTTPS / クッキー
- [ ] `NODE_ENV=production`（`__Secure-` プレフィックスのクッキーが有効化）
- [ ] HTTPS 必須（HSTS ヘッダーは production でのみ送信）
- [ ] `sameSite: "strict"`（既定）

### バックアップ
- [ ] SQLite の場合：`/data/hr-os.db*` を **暗号化したまま** S3 / R2 へ毎日 sync
- [ ] バックアップキーは KMS で管理、ローテーション可能に
- [ ] 7年保管（個人情報保護法 + 税法）

### 運用
- [ ] エラー監視（Sentry / Datadog）
- [ ] アクセスログ → 集約サービス（CloudWatch / Loki）
- [ ] アラート：ログイン失敗急増、レート制限ヒット、監査チェーン破損
- [ ] 定期実行：`pruneOldRateLimits()` を 1時間に1回

### 法的・コンプライアンス
- [ ] プライバシーポリシー / 個人情報取扱規程 公開
- [ ] PII アクセス監査ログ 7年保管
- [ ] マイナンバー取扱規程作成（社内）
- [ ] 委託先（学校→法人本社）契約書に再委託条項
- [ ] 退職者データの保管期限（最長 7年）と削除フロー

### モニタリング指標
- ログイン成功率
- ログイン失敗回数（攻撃検知）
- PII アクセス頻度
- 監査ログチェーン整合性（毎日チェック）
- DB サイズ推移
- レスポンスタイム p95
