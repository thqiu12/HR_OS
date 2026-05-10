# API リファレンス

このアプリは Next.js App Router の **Server Components + Server Actions** を主軸に構成しています。
従来の REST エンドポイントは認証関連のみで、それ以外のすべての書き込みは Server Action として実装されています。

## 認証エンドポイント (REST)

### `GET/POST /api/auth/[...nextauth]`
NextAuth v5 (Auth.js) の標準ハンドラー。NextAuth が自動的に以下を提供：

| エンドポイント | 用途 |
|---|---|
| `GET /api/auth/csrf` | CSRF トークン取得 |
| `POST /api/auth/callback/credentials` | ログイン送信（内部用） |
| `GET /api/auth/session` | 現在のセッション取得 |
| `GET /api/auth/signout` | サインアウト |

通常は **Server Action 経由** (`loginAction` / `logoutAction`) で利用するため、直接呼ぶことはありません。

---

## Server Actions

### 認証

#### `loginAction({ loginId, password, callbackUrl })`
**File:** `app/login/actions.ts`

| 項目 | 内容 |
|---|---|
| 認証 | 不要 |
| 副作用 | JWT セッションクッキー発行 |
| レート制限 | IP+loginId あたり 5回/分 |
| 監査ログ | `auth.login.success` / `auth.login.failed` / `auth.login.rate_limited` |

成功時：`{ redirect: "/dashboard" }`
失敗時：`{ error: "ログインIDまたはパスワードが正しくありません" }`

#### `logoutAction()`
**File:** `app/login/actions.ts`

セッションクッキーを破棄し、`auth.logout` を監査ログに記録。

---

### 採用管理

#### `moveCandidateStage(candidateId, stage)`
**File:** `lib/actions.ts`

| 項目 | 内容 |
|---|---|
| 認可 | `canMoveCandidateStage(session)` && `filterCandidates(session, [c], jobs).length > 0` |
| 許可ロール | group_admin / entity_hr / school_hr / principal / manager |
| エラー | `AuthError(401)` 未ログイン / `AuthError(403)` 権限/スコープ不足 / `AuthError(404)` 候補者なし |
| 監査ログ | `candidate.move_stage` / `.denied` |
| Revalidate | `/recruiting/pipeline`, `/dashboard` |

---

### 入社手続き

#### `setDocStatus(caseId, docCode, status, rejectReason?)`
**File:** `lib/actions.ts`

| 項目 | 内容 |
|---|---|
| 認可 | `canApproveOnboarding(session)` && `filterOnboardingCases(session, [c]).length > 0` |
| 許可ロール | group_admin / entity_hr / school_hr |
| エラー | 上記同様 |
| 監査ログ | `onboarding.set_doc` / `.denied` |
| Revalidate | `/onboarding/cases/[id]`, `/onboarding/cases`, `/dashboard` |

ステータス遷移：`未提出 → 提出済 → 確認中 → 完了 / 差戻し`

---

### 内定者ポータル（無認証）

#### `submitDocViaInvite(token, docCode)`
**File:** `app/onboarding/invite/[token]/actions.ts`

| 項目 | 内容 |
|---|---|
| 認可 | 招待トークン検証のみ。ログイン不要 |
| トークン | JWT (HS256, AUTH_SECRET 署名)、30日有効 |
| ステータス遷移 | 未提出/差戻し → 提出済 のみ許可（自動承認は不可） |
| 監査ログ | `invite.submit` / `.failed`、user_login = `invite:<jti先頭8字>` |
| Revalidate | invite ページ、対応する case ページ、dashboard |

---

## 招待トークン (JWT)

### 形式
```
header.payload.signature
```

### Payload
```json
{
  "iss": "hr-os",
  "aud": "onboarding-portal",
  "sub": "<case_id>",
  "jti": "<24char hex>",
  "iat": <unix>,
  "exp": <unix>
}
```

### 検証フロー (`verifyInviteToken`)
1. レート制限チェック（IP あたり 30回/分）
2. JWT 署名検証 (HS256, AUTH_SECRET)
3. `iss` / `aud` 検証
4. 有効期限検証
5. DB の `invite_tokens` テーブルで `jti` の存在 + 未失効を確認
6. `case_id` の一致確認

### エラーコード
| reason | 意味 |
|---|---|
| `invalid_signature` | 署名不正 |
| `expired` | 有効期限切れ |
| `wrong_audience` | aud 不一致 |
| `wrong_issuer` | iss 不一致 |
| `revoked` | 失効済み |
| `unknown_jti` | DB 未登録（偽造） |
| `rate_limited` | レート制限超過 |

---

## PII 暗号化 API

### `encryptPII(plaintext: string): string`
AES-256-GCM で暗号化。形式：`b64u(iv).b64u(tag).b64u(ciphertext)`

### `decryptPII(token: string): string`
復号。改ざんされている場合は GCM 認証タグ検証が失敗して例外。

### `maskPII(plaintext, keep=4): string`
末尾 N 文字以外をマスク（例：`••••••7890`）。

---

## レート制限 API

### `checkRateLimit(key, max, windowSec)`
SQLite ベースの sliding window。返り値：
```ts
{ allowed: true,  remaining: number, resetAt: number } |
{ allowed: false, remaining: 0, resetAt: number, retryAfter: number }
```

### 既定の制限
| 用途 | キー | 上限 |
|---|---|---|
| ログイン | `login:<ip>:<loginId>` | 5回/分 |
| 招待検証 | `invite:<ip>` | 30回/分 |

---

## 監査ログ API

### `logAudit(entry)`
書き込み専用。失敗してもユーザー操作はブロックしない。
ハッシュチェーン (`prev_hash` + `row_hash`) により改ざん検出可能。

### `db.verifyAuditChain()`
全行を走査して整合性を検証。
- 成功：`{ ok: true, count, headHash }`
- 失敗：`{ ok: false, brokenAt: id, reason }`

---

## ルート保護

`middleware.ts` がすべてのリクエストをチェック：

| ルート | 認証 | スコープ |
|---|---|---|
| `/login` | 不要 | - |
| `/api/auth/*` | 不要 | - |
| `/onboarding/invite/*` | トークンのみ | - |
| `/dashboard` 他 | 必須 | ロール依存 |
| `/settings/*` | 必須 | group_admin or auditor のみ |
