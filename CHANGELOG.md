# Changelog

All notable changes to this project documented here. Format: [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — Production hardening

### Security
- **Login rate limit**: Added per-IP throttle (30/min) on top of per-IP+ID (5/min) to defeat credential stuffing.
- **CSP**: `Content-Security-Policy` header in production (frame-ancestors none, restricted script/style/connect sources).
- **CSRF**: Middleware-level Origin == Host check on all state-changing requests.
- **2FA / TOTP**: Optional per-user TOTP (RFC 6238). Enable via `/settings/2fa`.
- **IP allowlist**: Per-role `IP_ALLOWLIST_<ROLE>` env (CIDR supported).
- **Session revocation**: `session_revocations` table; admin can revoke active sessions immediately.
- **Sentry error boundaries**: `app/error.tsx` + `app/global-error.tsx` capture client errors.

### Compliance / Privacy
- **Retention policy** (`lib/retention.ts`): Anonymize rejected candidates at 90 days, hard-delete at 365 days; clear retired employee PII at 5 years (per labor law).
- **Right of access**: `exportEmployeeDataAction` returns full employee record + PII + audit trail as JSON.
- **Right to erasure**: `softDeleteEmployeeAction` clears PII immediately and revokes user sessions.
- **Cron `/api/cron/retention`**: Bearer-auth daily job that enforces the policy.

### Reliability
- **Env validation** (`lib/env-check.ts`): Fail-fast on missing `AUTH_SECRET`/`AUTH_TRUST_HOST`/`CRON_SECRET` in production.
- **`/api/health`**: Liveness + readiness probe (DB / uploads / disk).
- **Email bounce webhook** (`/api/webhooks/resend`): Updates `email_logs.status` based on Resend events; surfaces bounces and complaints to audit.

### Operations
- **Litestream config** (`scripts/litestream.yml`): Continuous SQLite replication to S3.
- **Manual backup script** (`scripts/backup.sh`): Hourly snapshot + retention.
- **Key rotation script** (`scripts/rotate-pii-key.ts`): Re-encrypts PII under a new ENCRYPTION_KEY.
- **API budget alert** (`scripts/check-api-budget.ts`): Notifies at 80% / 100% of monthly Anthropic spend.
- **Admin metrics page** (`/settings/metrics`): DAU / MAU / error rate / email delivery / AI cost.

### Bug fixes
- Dashboard period filter only applies to "今月内定" / "今月入社" KPIs (公開求人 / 選考中 reflect current state).
- `lib/template-email-actions.ts` no longer re-exports non-async constants (was causing 500).
- Permission gates added to `/recruiting/*`, `/onboarding/cases`, `/reminders` pages.
- Dashboard hides HR-only widgets (alerts / funnel / onboarding cases) for users who can't see those modules.
- Org tree hides "+ 社員追加" / "部門管理" buttons from users without master-edit rights.

### Migrations added
- `015_session_revocations.sql`
- `016_user_2fa.sql`

## [0.1.0] — Initial demo

- Next.js 14 + better-sqlite3 + NextAuth v5
- 6 modules: dashboard / recruiting / onboarding / organization / performance / reminders / settings
- AI履歴書解析 (Anthropic Claude)
- 96 tests across 15 files
