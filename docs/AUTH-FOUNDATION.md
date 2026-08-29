# ATHR customer authentication — Patch 029

## Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`

## Security model

- Passwords are hashed server-side with Node.js `scrypt` and a random per-user salt.
- Browser sessions use 256-bit random opaque tokens.
- Only an HMAC hash of the session token is stored in PostgreSQL.
- The browser token is stored in an `HttpOnly` cookie.
- Cookies use `Secure` in production and `SameSite=Lax`.
- Local development intentionally omits the production cookie domain so authentication works on `127.0.0.1`.
- Login/register have a small process-local abuse limiter. Before horizontal production scaling, replace this with Redis/shared rate limiting.
- User status is checked whenever a session is resolved.
- `logout-all` revokes every active server-side session for the customer.

## Frontend

- `auth.html` provides login and registration.
- `account.html` is the customer account foundation.
- The navbar account icon now opens the real account flow.
- My Library and Orders are backed by authenticated commerce and private-download APIs.

## Production secret

Before production, generate a strong session secret, for example:

```bash
openssl rand -base64 64
```

Set it as `SESSION_SECRET` only on the server; never commit it.
