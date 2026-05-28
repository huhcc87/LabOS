#!/bin/bash
# LabOS Convex Backup Script
# Usage: ./scripts/backup.sh
# Cron: 0 2 * * * /path/to/scripts/backup.sh >> /var/log/labos-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/labos_backup_${TIMESTAMP}.zip"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting Convex backup..."

# Export all data from Convex
npx convex export --path "$BACKUP_FILE" 2>&1

if [ -f "$BACKUP_FILE" ]; then
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "[$(date)] Backup complete: $BACKUP_FILE ($SIZE)"

  # Keep only last 30 backups
  ls -t "$BACKUP_DIR"/labos_backup_*.zip 2>/dev/null | tail -n +31 | xargs -r rm
  echo "[$(date)] Old backups cleaned (keeping last 30)"
else
  echo "[$(date)] ERROR: Backup file not created"
  exit 1
fi
