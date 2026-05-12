#!/usr/bin/env node
/**
 * Production bootstrap — pure JS / no TypeScript / no tsx.
 *
 * Creates the first group_admin user, one entity, one school, one department
 * on a fresh production DB. Designed to be runnable inside the Fly.io
 * runtime container which only has the Next.js standalone bundle.
 *
 * Usage (run via `fly ssh console`):
 *
 *   fly ssh console -a hr-os -C "node /app/bootstrap-prod.js \
 *     --admin-login admin \
 *     --admin-name 'システム管理者' \
 *     --admin-email admin@example.jp \
 *     --admin-password 'PASSWORD_HERE' \
 *     --entity '学校法人さくら学園' \
 *     --school 'さくら日本語学校' \
 *     --school-type jls"
 *
 * Schema is duplicated here intentionally to avoid pulling lib/db.ts and
 * its 24 migrations through the build. If the schema for `users`,
 * `user_roles`, `schools`, or `departments` changes, update this file.
 */

const path = require("path");
const crypto = require("crypto");

// Resolve dependencies from the standalone output's node_modules.
// Next.js standalone copies better-sqlite3 (declared in serverComponentsExternalPackages)
// and bcryptjs (used by lib/db.ts) into .next/standalone/node_modules.
// When this script runs from /app via `node /app/bootstrap-prod.js`, those modules
// are already available because /app is the WORKDIR and node resolution finds
// /app/node_modules.
let Database;
let bcrypt;
try {
  Database = require("better-sqlite3");
  bcrypt = require("bcryptjs");
} catch (e) {
  console.error("[bootstrap] failed to load native deps:", e.message);
  console.error("[bootstrap] expected better-sqlite3 + bcryptjs in /app/node_modules");
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function required(name) {
  const v = arg(name);
  if (!v) { console.error(`Missing required arg: --${name}`); process.exit(1); }
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

  if (adminPassword.length < 12) {
    console.error("[bootstrap] admin password must be ≥12 chars");
    process.exit(1);
  }

  const dbPath = process.env.HR_DB_PATH || "/data/hr-os.db";
  console.log(`[bootstrap] opening DB at ${dbPath}`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Sanity check — migrations must have run already (via Next.js startup).
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','user_roles','schools','departments')").all();
  if (tables.length < 4) {
    console.error(`[bootstrap] expected 4 core tables, found ${tables.length}.`);
    console.error("[bootstrap] start the app once so Next.js applies migrations, then re-run this.");
    process.exit(1);
  }

  // Refuse to bootstrap a non-empty users table
  const existing = db.prepare("SELECT COUNT(*) AS n FROM users").get();
  if (existing.n > 0) {
    console.error(`[bootstrap] users table already has ${existing.n} row(s). Refusing to overwrite.`);
    console.error("[bootstrap] use the /settings/users UI to add more admins, or drop the DB to re-bootstrap.");
    process.exit(1);
  }

  const schoolId = `s_${crypto.randomBytes(4).toString("hex")}`;
  const deptId = `d_${crypto.randomBytes(4).toString("hex")}`;
  const adminId = `u_${crypto.randomBytes(5).toString("hex")}`;
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO schools (id, name, type, entity) VALUES (?, ?, ?, ?)`)
      .run(schoolId, schoolName, schoolType, entity);

    db.prepare(`INSERT INTO departments (id, school_id, name) VALUES (?, ?, ?)`)
      .run(deptId, schoolId, "管理部");

    db.prepare(`INSERT INTO users (id, login_id, email, name, password_hash, employee_id) VALUES (?, ?, ?, ?, ?, NULL)`)
      .run(adminId, adminLogin, adminEmail, adminName, passwordHash);

    db.prepare(`INSERT INTO user_roles (user_id, role, scope_type, scope_id) VALUES (?, 'group_admin', 'group', NULL)`)
      .run(adminId);
  });
  tx();

  db.close();

  console.log("\n✅ Bootstrap complete\n");
  console.log("  Login ID:   " + adminLogin);
  console.log("  Email:      " + adminEmail);
  console.log("  Entity:     " + entity);
  console.log("  School:     " + schoolName + " (id=" + schoolId + ")");
  console.log("  Department: 管理部 (id=" + deptId + ")");
  console.log("\nNext steps:");
  console.log("  1. Login at https://hr-os.fly.dev/login");
  console.log("  2. Enable 2FA at /settings/2fa");
  console.log("  3. Add more admins at /settings/users");
  console.log("  4. Rotate this password after handing off");
}

main().catch((e) => { console.error(e); process.exit(1); });
