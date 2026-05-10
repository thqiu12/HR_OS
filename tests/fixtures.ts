import { db } from "@/lib/db";
import type { Session } from "next-auth";

/**
 * Build a Session object for a seeded demo user by login id.
 * Uses the real DB so it always reflects the current seed.
 */
export function sessionFor(loginId: string): Session {
  const user = db.userByLogin(loginId) as any;
  if (!user) throw new Error(`Seed missing user: ${loginId}`);
  const roles = db.rolesByUserId(user.id) as any[];
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      loginId: user.loginId,
      employeeId: user.employeeId ?? null,
    },
    roles,
    expires: new Date(Date.now() + 86400_000).toISOString(),
  } as any;
}
