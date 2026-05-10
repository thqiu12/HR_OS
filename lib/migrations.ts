import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";

/**
 * Apply any *.sql files in /migrations that haven't been recorded in
 * schema_migrations yet. Each migration runs in its own transaction.
 *
 * File naming convention: NNN_description.sql (sorted lexicographically).
 */
export function runMigrations(conn: Database.Database, migrationsDir?: string) {
  const dir = migrationsDir || path.join(process.cwd(), "migrations");

  conn.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  if (!fs.existsSync(dir)) return [];

  const applied = new Set<string>(
    conn.prepare("SELECT version FROM schema_migrations").all().map((r: any) => r.version)
  );

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const newlyApplied: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const tx = conn.transaction(() => {
      conn.exec(sql);
      conn.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        version,
        new Date().toISOString()
      );
    });
    try {
      tx();
      newlyApplied.push(version);
      console.log(`[migrations] applied ${version}`);
    } catch (e) {
      console.error(`[migrations] FAILED ${version}:`, e);
      throw e;
    }
  }
  return newlyApplied;
}

export function appliedMigrations(conn: Database.Database): string[] {
  try {
    return conn
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all()
      .map((r: any) => r.version);
  } catch {
    return [];
  }
}
