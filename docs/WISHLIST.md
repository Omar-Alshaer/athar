# ATHR Wishlist — Patch 030

## Behaviour

- Guests use `localStorage` key `athr-wishlist` in the current browser.
- Signed-in customers use PostgreSQL `WishlistItem` rows.
- Guest favorites are merged into the signed-in account on the next page load after login/register.
- The guest browser list is removed after a successful merge, avoiding accidental cross-account carry-over.

## API

All endpoints below require a valid ATHR session cookie:

- `GET /api/wishlist`
- `POST /api/wishlist/:slug`
- `DELETE /api/wishlist/:slug`
- `POST /api/wishlist/sync` with `{ "productSlugs": ["..."] }`

Only published products in active categories can be added or returned.
