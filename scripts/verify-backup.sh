#!/bin/bash
# Backup verification — restore the latest backup to a temp DB and run sanity checks.
# Run weekly via cron to ensure backups are actually restorable.
#
# Usage: ./scripts/verify-backup.sh [backup-dir]

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
LATEST=$(ls -t "$BACKUP_DIR"/hr-os.*.db.gz 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
  echo "[verify] no backups found in $BACKUP_DIR"
  exit 1
fi

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

echo "[verify] restoring $LATEST → $TMP/restored.db"
gunzip -c "$LATEST" > "$TMP/restored.db"

echo "[verify] integrity check"
RESULT=$(sqlite3 "$TMP/restored.db" "PRAGMA integrity_check;")
if [ "$RESULT" != "ok" ]; then
  echo "[verify] ❌ integrity check failed: $RESULT"
  exit 1
fi

echo "[verify] schema sanity"
TABLES=$(sqlite3 "$TMP/restored.db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
if [ "$TABLES" -lt 10 ]; then
  echo "[verify] ❌ unexpectedly few tables: $TABLES"
  exit 1
fi

echo "[verify] data sanity"
USERS=$(sqlite3 "$TMP/restored.db" "SELECT COUNT(*) FROM users;")
SCHOOLS=$(sqlite3 "$TMP/restored.db" "SELECT COUNT(*) FROM schools;")
echo "[verify]   tables=$TABLES users=$USERS schools=$SCHOOLS"

if [ "$USERS" -lt 1 ] || [ "$SCHOOLS" -lt 1 ]; then
  echo "[verify] ❌ no users/schools — likely corrupted backup"
  exit 1
fi

echo "[verify] ✅ backup is restorable: $LATEST"
