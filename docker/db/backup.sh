#!/bin/sh
# =============================================================
# PostgreSQL Daily Backup Script
# Runs inside streambingo-db container
# Output: /backups/streambingo_YYYY-MM-DD.sql.gz
# =============================================================

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="${BACKUP_DIR}/streambingo_${DATE}.sql.gz"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"

mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting backup: ${BACKUP_FILE}"
pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "${BACKUP_FILE}"
echo "[backup] Backup complete: ${BACKUP_FILE}"

# Remove backups older than RETENTION_DAYS
find "${BACKUP_DIR}" -name "streambingo_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[backup] Cleaned up backups older than ${RETENTION_DAYS} days"
