#!/usr/bin/env bash
set -Eeuo pipefail

API_URL="${ATHR_HEALTH_URL:-http://127.0.0.1:4000/api}"
curl --fail --silent --show-error --max-time 8 "${API_URL}/health/live" >/dev/null
curl --fail --silent --show-error --max-time 8 "${API_URL}/health/ready" | grep -q '"status":"ready"'
echo "ATHR API liveness and readiness passed."
