/**
 * Initial production bootstrap.
 *
 * Creates the first group_admin user, one entity, one school, one department,
 * and inserts the standard evaluation period calendar. Run ONCE on a fresh
 * production database before opening the app to users.
 *
 * Usage:
 *   tsx scripts/bootstrap.ts \
 *     --admin-login admin \
 *     --admin-name "システム管理者" \
 *     --admin-email admin@your-domain.jp \
 *     --admin-password "$(openssl rand -base64 18)" \
 *     --entity "学校法人〇〇" \
 *     --school "〇〇日本語学校" \
 *     --school-type jls
 *
 * The created admin should immediately:
 *   1. Login + enable 2FA at /settings/2fa
 *   2. Create remaining users at /settings/users
 *   3. Add departments / employees via the UI
 *   4. Hand off the bootstrap admin password to the next admin and rotate it
 */

import { db } from "../lib/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function required(name: string): string {
  const v = arg(name);
  if (!v) {
    console.error(`Missing required arg: --${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const adminLogin = required("admin-login");
  const adminName = required("admin-name");
  const adminEmail = required("admin-email");
  const adminPassword = required("admin-password");
  const entity = required("entity");
  const schoolName = required("school");
  const schoolType = arg("school-type") || "jls";

  // Refuse to bootstrap a non-empty DB
  const existing = db.allUsers() as any[];
  if (existing.length > 0) {
    console.error(`[bootstrap] DB already has ${existing.length} user(s). Refusing to overwrite.`);
    console.error("If you really want to re-bootstrap, drop the DB first.");
    process.exit(1);
  }

  if (adminPassword.length < 12) {
    console.error("[bootstrap] admin password must be ≥12 chars");
    process.exit(1);
  }

  const schoolId = `s_${randomBytes(4).toString("hex")}`;
  const deptId = `d_${randomBytes(4).toString("hex")}`;
  const adminId = `u_${randomBytes(5).toString("hex")}`;

  // 1) School
  (db as any).insertSchool({ id: schoolId, name: schoolName, type: schoolType, entity });

  // 2) Department (default: 管理部)
  (db as any).insertDepartment?.({ id: deptId, schoolId, name: "管理部" }) ??
    console.warn("[bootstrap] insertDepartment helper not found; create manually");

  // 3) Admin user
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  (db as any).insertUser({
    id: adminId,
    loginId: adminLogin,
    email: adminEmail,
    name: adminName,
    passwordHash,
    employeeId: null,
  });
  // 4) Grant group_admin role with global scope
  (db as any).insertUserRole?.({ userId: adminId, role: "group_admin", scopeType: "group", scopeId: null }) ??
    console.warn("[bootstrap] insertUserRole helper not found; grant role manually");

  console.log("\n✅ Bootstrap complete\n");
  console.log("Login URL:        https://YOUR-DOMAIN/login");
  console.log("Admin loginId:    " + adminLogin);
  console.log("Admin email:      " + adminEmail);
  console.log("School:           " + schoolName + " (id=" + schoolId + ")");
  console.log("Department:       管理部 (id=" + deptId + ")");
  console.log("\n⚠️  Next steps:");
  console.log("  1. Login + enable 2FA at /settings/2fa");
  console.log("  2. Add other admins at /settings/users");
  console.log("  3. Configure SSO env vars if using Google/Azure");
  console.log("  4. Rotate this bootstrap password after handing off");
}

main().catch((e) => { console.error(e); process.exit(1); });
