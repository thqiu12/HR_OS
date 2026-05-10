import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import AzureAD from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { loginRateLimit, loginIpRateLimit } from "@/lib/rate-limit";
import { checkRoleAllowlist } from "@/lib/ip-allowlist";
import { verifyTotp } from "@/lib/totp";
import authConfig from "./auth.config";

function getClientIp(): string {
  try {
    const h = headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

const ssoProviders = [
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    : null,
  process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET
    ? AzureAD({
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        // tenantId is optional but recommended in production
        ...(process.env.AZURE_AD_TENANT_ID ? { issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0` } : {}),
      })
    : null,
].filter(Boolean) as any[];

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    ...ssoProviders,
    Credentials({
      credentials: { loginId: {}, password: {}, otp: {} },
      authorize: async (creds) => {
        const loginId = String(creds?.loginId || "");
        const password = String(creds?.password || "");
        const otp = String(creds?.otp || "").trim();
        if (!loginId || !password) {
          await logAudit({ action: "auth.login.failed", reason: "missing_credentials", user: { loginId } });
          return null;
        }
        const ip = getClientIp();
        const rlIp = loginIpRateLimit(ip);
        if (rlIp.allowed === false) {
          await logAudit({ action: "auth.login.rate_limited", reason: `ip_retry_after=${rlIp.retryAfter}s`, user: { loginId } });
          return null;
        }
        const rl = loginRateLimit(ip, loginId);
        if (rl.allowed === false) {
          await logAudit({ action: "auth.login.rate_limited", reason: `id_retry_after=${rl.retryAfter}s`, user: { loginId } });
          return null;
        }
        const user = db.userByLogin(loginId);
        if (!user) {
          await logAudit({ action: "auth.login.failed", reason: "unknown_user", user: { loginId } });
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await logAudit({ action: "auth.login.failed", reason: "bad_password", user: { id: user.id, loginId } });
          return null;
        }
        // 2FA: when enabled, require a valid TOTP code
        if (user.totpSecret) {
          if (!otp) {
            await logAudit({ action: "auth.login.failed", reason: "otp_required", user: { id: user.id, loginId } });
            return null;
          }
          if (!verifyTotp(user.totpSecret, otp)) {
            await logAudit({ action: "auth.login.failed", reason: "otp_invalid", user: { id: user.id, loginId } });
            return null;
          }
        }
        // IP allowlist enforcement (configured per role via env IP_ALLOWLIST_<ROLE>)
        const userRoles = db.rolesByUserId(user.id) as { role: string }[];
        const blockedRole = checkRoleAllowlist(ip, userRoles);
        if (blockedRole) {
          await logAudit({ action: "auth.login.ip_blocked", reason: `role=${blockedRole} ip=${ip}`, user: { id: user.id, loginId } });
          return null;
        }
        await logAudit({ action: "auth.login.success", user: { id: user.id, loginId } });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          loginId: user.loginId,
          employeeId: user.employeeId,
        } as any;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // For SSO providers (Google, Azure AD): require the email to match a
      // pre-provisioned user in our DB. Don't auto-create users — admin must
      // invite them first.
      if (account?.provider && account.provider !== "credentials") {
        const email = user.email;
        if (!email) {
          await logAudit({ action: "auth.sso.no_email", reason: account.provider });
          return false;
        }
        const local = db.userByEmail(email);
        if (!local) {
          await logAudit({ action: "auth.sso.unknown_email", reason: account.provider, user: { loginId: email } });
          return "/login?error=sso_unknown_user";
        }
        await logAudit({ action: "auth.sso.success", user: { id: local.id, loginId: local.loginId }, reason: account.provider });
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        // SSO: resolve local user by email; credentials: user.id is already the local id
        let localUser: any = null;
        if (account?.provider !== "credentials" && user.email) {
          localUser = db.userByEmail(user.email);
        } else {
          localUser = db.userById(user.id as string);
        }
        if (localUser) {
          token.userId = localUser.id;
          token.loginId = localUser.loginId;
          token.employeeId = localUser.employeeId ?? null;
          token.roles = db.rolesByUserId(localUser.id);
          token.iat = Math.floor(Date.now() / 1000);
        }
      }
      // Session revocation check: reject tokens issued before the user's revoked_at
      if (token.userId) {
        const revokedAt = db.sessionRevokedAt(token.userId as string);
        if (revokedAt && token.iat) {
          const revokedSec = Math.floor(new Date(revokedAt).getTime() / 1000);
          if ((token.iat as number) < revokedSec) {
            // Returning a token without userId effectively unauthenticates the request
            return { ...token, userId: undefined, roles: [] } as any;
          }
        }
      }
      return token;
    },
  },
});
