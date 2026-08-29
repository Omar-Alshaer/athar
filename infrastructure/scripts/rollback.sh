#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then echo "Run as root." >&2; exit 1; fi
RELEASE_ID="${1:-}"
if [[ ! "${RELEASE_ID}" =~ ^[0-9]{14}$ ]]; then
  echo "Usage: rollback.sh RELEASE_ID (UTC YYYYMMDDhhmmss)" >&2
  exit 2
fi

APP_RELEASE="/opt/athr/releases/${RELEASE_ID}"
WEB_RELEASE="/var/www/athr/releases/${RELEASE_ID}"
[[ -d "${APP_RELEASE}" && -d "${WEB_RELEASE}" ]] || { echo "Release not found." >&2; exit 1; }

ln -sfn "${APP_RELEASE}" /opt/athr/current
ln -sfn "${WEB_RELEASE}" /var/www/athr/current
systemctl restart athr-api.service
nginx -t
systemctl reload nginx
"${APP_RELEASE}/infrastructure/scripts/health-check.sh"
echo "Rolled application files back to ${RELEASE_ID}. Database migrations were not reversed."
