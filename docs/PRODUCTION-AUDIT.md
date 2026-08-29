# Production-hardening audit classification

The repository was reviewed across Git state, static storefront, authentication, admin, Prisma, private storage, Cloudinary, XPay, QA, environment handling, and deployment paths.

| Classification | Findings and disposition |
| --- | --- |
| Production-safe | Server-authoritative product pricing/totals, SAR defaults through a forward migration, quantity-one enforcement, raw-body XPay verification, timing-safe signatures, webhook event uniqueness, monotonic paid-state handling, idempotent library grants, authenticated ownership checks, attachment/no-store downloads, audit records, password scrypt hashing, HttpOnly sessions, strict CORS allowlist, admin role guard, Cloudinary server-side secrets, private randomized storage keys, path traversal protection, and idempotent catalog seed. |
| Local-only | `127.0.0.1`/`localhost` origins, MOCK provider/page, Docker development PostgreSQL password, example.com QA identities, temporary QA catalog/customer/order records, compiled local API QA logs, and development documentation. These remain confined to ignored/local tooling and the production static build excludes MOCK assets. |
| Obsolete | Customer-facing WhatsApp checkout code, “Mock then XPay” admin copy, “payment coming later” language, inline CSP-incompatible script, and stale README deployment narrative were removed or replaced. No Vercel configuration or active Vercel deployment reference remained. |
| Security-sensitive | Production MOCK fallback, public API bind, weak phone regex, MIME-header-only uploads, broad cookie-domain example, incomplete readiness, resume-link provider handling, and missing fail-closed env validation were corrected. Secrets remain ignored and production templates contain placeholders only. |
| Customer-facing issue | Registration now requires a searchable all-country phone selector and friendly validation; backend normalization stores E.164 plus ISO country. Checkout uses the same model. Technical provider wording and false redirect-success behavior are absent. Pending orders can resume only a stored server-created hosted URL. |
| Deployment blocker | Repository-side OVH deployment, Nginx, systemd, health, backup, rollback, cleanliness audit, and deterministic preflight are supplied. External launch still requires an inspected OVH host/SSH access, working DNS/HTTPS, a fresh or explicitly approved database, Cloudinary production credentials, and an activated XPay LIVE account with LIVE API/webhook secrets. |

Historical USD rows are deliberately not rewritten. Only future schema defaults and admin-created products are constrained to SAR.
