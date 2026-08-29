# ATHR production deployment on OVH

This runbook targets a modern Ubuntu/Debian OVH VPS. Do not run the install or deploy commands until the host, DNS, and XPay LIVE account are confirmed. The deployment never imports the local QA database.

## 1. Inspect the host before changing it

Run read-only checks and record the results:

```bash
cat /etc/os-release
nproc
free -h
df -h
ss -lntup
systemctl --type=service --state=running
ufw status verbose
docker version
nginx -v
psql --version
```

Identify every existing application, virtual host, database, and occupied port. Back up any existing ATHR release, PostgreSQL database, `/etc/athr`, Nginx configuration, and digital storage before replacement. Do not overwrite unrelated services.

## 2. Base layout and permissions

Install Node.js 22 LTS, PostgreSQL 16+, Nginx, Certbot, `rsync`, and build tools from trusted repositories. Create a locked service account and directories:

```bash
adduser --system --group --home /opt/athr athr
install -d -o athr -g athr -m 0750 /opt/athr/releases /var/lib/athr/private
install -d -o root -g www-data -m 0755 /var/www/athr/releases
install -d -o root -g athr -m 0750 /etc/athr
install -d -o root -g root -m 0700 /var/backups/athr
install -d -o www-data -g www-data -m 0755 /var/www/letsencrypt
```

PostgreSQL must listen only on loopback. Create a dedicated database/user with a unique random password, persist data under the distribution-managed PostgreSQL data directory, and keep port 5432 closed publicly. Permit only SSH, HTTP, and HTTPS in the firewall; port 4000 remains loopback-only.

## 3. Secrets and domains

Copy `athr.env.production.example` to `/etc/athr/athr.env`, replace every placeholder, then apply `chmod 0640` and `chown root:athr`. Prefer a blank `COOKIE_DOMAIN`, which keeps both HttpOnly session cookies host-only on the API host.

Point confirmed DNS A/AAAA records for the storefront, admin, and API domains at the OVH server. The repository currently confirms `athar-online.com`, `admin.athar-online.com`, and `api.athar-online.com`; change all application origins consistently if ownership of those names is not confirmed before launch.

Generate `SESSION_SECRET` using a cryptographic generator, for example `openssl rand -base64 48`. Do not place bootstrap admin credentials permanently in `/etc/athr/athr.env`.

## 4. Nginx and HTTPS

Render the HTTP bootstrap template with explicit domains, test Nginx, and request one certificate per domain:

```bash
export STORE_DOMAIN=athar-online.com ADMIN_DOMAIN=admin.athar-online.com API_DOMAIN=api.athar-online.com
envsubst '${STORE_DOMAIN} ${ADMIN_DOMAIN} ${API_DOMAIN}' < infrastructure/production/nginx/athr-http.conf.template > /etc/nginx/sites-available/athr.conf
ln -s /etc/nginx/sites-available/athr.conf /etc/nginx/sites-enabled/athr.conf
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/letsencrypt -d "$STORE_DOMAIN"
certbot certonly --webroot -w /var/www/letsencrypt -d "$ADMIN_DOMAIN"
certbot certonly --webroot -w /var/www/letsencrypt -d "$API_DOMAIN"
envsubst '${STORE_DOMAIN} ${ADMIN_DOMAIN} ${API_DOMAIN}' < infrastructure/production/nginx/athr.conf.template > /etc/nginx/sites-available/athr.conf
nginx -t && systemctl reload nginx
certbot renew --dry-run
```

Install the systemd unit at `/etc/systemd/system/athr-api.service`, then run `systemctl daemon-reload && systemctl enable athr-api.service`. Logs are retained by journald; configure host-level persistent journal retention and monitoring appropriate to available disk.

## 5. Database, catalog, and data cleanliness

Use a fresh production database unless the owner explicitly approves another production dataset. Never copy the current local development/QA database into production.

Deployment runs `npm run prisma:migrate:deploy`. It never runs `prisma migrate dev` and never seeds. `npm run prisma:seed` is an explicit, idempotent starter-catalog action: it creates/updates only the five intended categories and five 39.99 SAR products. Review those records with the owner before running it.

Run the read-only cleanliness audit with `psql "$DATABASE_URL" -f infrastructure/production/production-data-audit.sql`. Review flagged QA/test rows manually; the audit deletes nothing.

## 6. Deploy, health, rollback

From a verified checkout of `main`, install the service/Nginx files first and then run:

```bash
sudo infrastructure/scripts/deploy.sh /absolute/path/to/athr-store
```

The deploy creates timestamped application and static releases, installs locked dependencies, builds production assets, applies deterministic migrations, runs fail-closed preflight, prunes development/optional build tooling, atomically switches symlinks, restarts the API, checks Nginx, and verifies health. The public static build intentionally excludes the local mock payment page.

List retained releases and roll application files back with:

```bash
ls -1 /opt/athr/releases
sudo infrastructure/scripts/rollback.sh YYYYMMDDhhmmss
```

Rollback does not reverse database migrations. Migrations must remain backward-compatible. For a data-level rollback, stop writes, take a fresh safety backup, then restore an approved database dump and matching private-files archive during a maintenance window.

## 7. Backups and restore

Schedule `infrastructure/scripts/backup.sh` with a root-owned systemd timer or cron. It creates a PostgreSQL custom dump, private-files archive, and checksums under `/var/backups/athr`, then removes files older than the configured retention. Copy backups to encrypted off-server storage and test restores regularly.

Restore only after explicit approval and maintenance mode:

```bash
pg_restore --list /var/backups/athr/database-TIMESTAMP.dump
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" /var/backups/athr/database-TIMESTAMP.dump
tar -tzf /var/backups/athr/digital-files-TIMESTAMP.tar.gz
```

Restore the file archive into an empty, permission-correct staging directory first, verify it, then switch `DIGITAL_STORAGE_ROOT` or move it into place.

## 8. XPay LIVE handoff

In the XPay LIVE dashboard configure exactly:

`https://api.athar-online.com/api/commerce/webhooks/xpay`

Subscribe to checkout completion, async success/failure, and expiry events used by the API. Put the LIVE signing secret in `/etc/athr/athr.env`; do not reuse TEST credentials. Set LIVE return/cancel HTTPS URLs, restart the API, and run `npm run production:preflight -- --env-file=/etc/athr/athr.env`.

The browser redirect is informational only. The signed, idempotent webhook remains the source of truth for PAID status and library grants. Do not perform a LIVE transaction without owner authorization.
