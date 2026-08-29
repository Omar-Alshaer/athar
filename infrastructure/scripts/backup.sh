#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ENV_FILE="${ATHR_ENV_FILE:-/etc/athr/athr.env}"
BACKUP_ROOT="${ATHR_BACKUP_ROOT:-/var/backups/athr}"
RETENTION_DAYS="${ATHR_BACKUP_RETENTION_DAYS:-14}"

[[ "${BACKUP_ROOT}" == /var/backups/athr* ]] || { echo "Unsafe backup root." >&2; exit 1; }
[[ -r "${ENV_FILE}" ]] || { echo "Environment file is not readable." >&2; exit 1; }
install -d -m 0700 "${BACKUP_ROOT}"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_FILE="${BACKUP_ROOT}/database-${STAMP}.dump"
FILES_FILE="${BACKUP_ROOT}/digital-files-${STAMP}.tar.gz"

node "$(dirname "$0")/with-env.mjs" "${ENV_FILE}" pg_dump --format=custom --file="${DB_FILE}" '{DATABASE_URL}'
node "$(dirname "$0")/with-env.mjs" "${ENV_FILE}" tar --create --gzip --file="${FILES_FILE}" --directory='{DIGITAL_STORAGE_ROOT}' .
sha256sum "${DB_FILE}" "${FILES_FILE}" > "${BACKUP_ROOT}/checksums-${STAMP}.sha256"
find "${BACKUP_ROOT}" -maxdepth 1 -type f -mtime "+${RETENTION_DAYS}" -delete
echo "ATHR database and private files backed up at ${STAMP}. Copy backups off-server."
