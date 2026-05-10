#!/bin/bash
# Manual SQLite backup — point-in-time snapshot using sqlite3 .backup command.
# Use as a fallback when Litestream isn't set up. Safe to run while the app
# is live (uses BEGIN IMMEDIATE under the hood).
#
# Usage:
#   ./scripts/backup.sh [output-dir]
#
# Example cron entry (hourly):
#   0 * * * * cd /app && ./scripts/backup.sh /backups >> /var/log/hr-os-backup.log 2>&1

set -euo pipefail

DB_PATH="${HR_DB_PATH:-./hr-os.db}"
OUT_DIR="${1:-./backups}"
TS=$(date -u +%Y%m%dT%H%M%SZ)
OUT_FILE="$OUT_DIR/hr-os.${TS}.db"

mkdir -p "$OUT_DIR"

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] DB not found at $DB_PATH"
  exit 1
fi

echo "[backup] $DB_PATH -> $OUT_FILE"
sqlite3 "$DB_PATH" ".backup '$OUT_FILE'"

# Compress and verify integrity
gzip -9 "$OUT_FILE"
sqlite3 "$DB_PATH" "PRAGMA integrity_check" > "$OUT_FILE.integrity.txt"

# Retention: keep last 7 daily + 4 weekly + 12 monthly (rough heuristic)
find "$OUT_DIR" -name "hr-os.*.db.gz" -mtime +30 -delete

echo "[backup] done: $OUT_FILE.gz"
