import type { NextAuthConfig } from "next-auth";

export type RoleScope = { role: string; scopeType: string; scopeId: string | null };

declare module "next-auth" {
  interface Session {
    user: { id: string; name: string; email: string; loginId: string; employeeId: string | null };
    roles: RoleScope[];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    loginId?: string;
    employeeId?: string | null;
    roles?: RoleScope[];
  }
}

const isProd = process.env.NODE_ENV === "production";

const authConfig = {
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const, maxAge: 8 * 60 * 60 }, // 8h
  cookies: {
    sessionToken: {
      name: isProd ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict" as const,
        path: "/",
        secure: isProd,
      },
    },
  },
  useSecureCookies: isProd,
  callbacks: {
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      if (token.loginId) session.user.loginId = token.loginId as string;
      session.user.employeeId = (token.employeeId as string | null) ?? null;
      session.roles = (token.roles as RoleScope[]) ?? [];
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;

export default authConfig;
