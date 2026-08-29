#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root on the inspected ATHR OVH host." >&2
  exit 1
fi

SOURCE_DIR="${1:-}"
if [[ -z "${SOURCE_DIR}" || ! -f "${SOURCE_DIR}/package.json" ]]; then
  echo "Usage: deploy.sh /absolute/path/to/checked-out/athr-store" >&2
  exit 2
fi

ENV_FILE="/etc/athr/athr.env"

NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"

if [[ -z "${NODE_BIN}" || -z "${NPM_BIN}" ]]; then
  echo "node/npm are required for ATHR deployment." >&2
  exit 1
fi
if [[ ! -r "${ENV_FILE}" ]]; then
  echo "Missing protected environment file: ${ENV_FILE}" >&2
  exit 1
fi

RELEASE_ID="$(date -u +%Y%m%d%H%M%S)"
APP_RELEASE="/opt/athr/releases/${RELEASE_ID}"
WEB_RELEASE="/var/www/athr/releases/${RELEASE_ID}"

install -d -o athr -g athr -m 0750 /opt/athr/releases /var/lib/athr/private
install -d -o root -g www-data -m 0755 /var/www/athr/releases
install -d -o root -g athr -m 0750 /etc/athr
install -d -o root -g root -m 0755 "${APP_RELEASE}" "${WEB_RELEASE}"

if [[ -L /opt/athr/current ]]; then
  ATHR_ENV_FILE="${ENV_FILE}" "${SOURCE_DIR}/infrastructure/scripts/backup.sh"
fi

rsync -a --delete --exclude='.git/' --exclude='.env' --exclude='.local/' --exclude='node_modules/' --exclude='.build/' "${SOURCE_DIR}/" "${APP_RELEASE}/"
chown -R athr:athr "${APP_RELEASE}"

runuser -u athr -- "${NPM_BIN}" --prefix "${APP_RELEASE}" ci
runuser -u athr -- "${NPM_BIN}" --prefix "${APP_RELEASE}" run build:web
runuser -u athr -- "${NODE_BIN}" "${APP_RELEASE}/infrastructure/scripts/with-env.mjs" "${ENV_FILE}" "${NPM_BIN}" --prefix "${APP_RELEASE}" run build:api
runuser -u athr -- "${NODE_BIN}" "${APP_RELEASE}/infrastructure/scripts/with-env.mjs" "${ENV_FILE}" "${NPM_BIN}" --prefix "${APP_RELEASE}" run prisma:migrate:deploy
runuser -u athr -- "${NODE_BIN}" "${APP_RELEASE}/infrastructure/scripts/production-preflight.mjs" "--env-file=${ENV_FILE}" --skip-api
runuser -u athr -- "${NPM_BIN}" --prefix "${APP_RELEASE}" prune --omit=dev --omit=optional

cp -a "${APP_RELEASE}/.build/storefront" "${WEB_RELEASE}/storefront"
cp -a "${APP_RELEASE}/.build/admin" "${WEB_RELEASE}/admin"
chown -R root:www-data "${WEB_RELEASE}"
find "${WEB_RELEASE}" -type d -exec chmod 0755 {} +
find "${WEB_RELEASE}" -type f -exec chmod 0644 {} +

PREVIOUS_APP="$(readlink -f /opt/athr/current 2>/dev/null || true)"
PREVIOUS_WEB="$(readlink -f /var/www/athr/current 2>/dev/null || true)"
[[ -n "${PREVIOUS_APP}" ]] && ln -sfn "${PREVIOUS_APP}" /opt/athr/previous
[[ -n "${PREVIOUS_WEB}" ]] && ln -sfn "${PREVIOUS_WEB}" /var/www/athr/previous
ln -sfn "${APP_RELEASE}" /opt/athr/current
ln -sfn "${WEB_RELEASE}" /var/www/athr/current

systemctl daemon-reload
systemctl restart athr-api.service
nginx -t
systemctl reload nginx
"${APP_RELEASE}/infrastructure/scripts/health-check.sh"
"${NODE_BIN}" "${APP_RELEASE}/infrastructure/scripts/production-preflight.mjs" "--env-file=${ENV_FILE}"

echo "ATHR release ${RELEASE_ID} deployed successfully."
