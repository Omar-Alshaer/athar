# ATHR Catalog API — Patch 028

Patch 028 moves the public storefront catalog source from hardcoded `data.js` product/category arrays to PostgreSQL through the ATHR API.

## Public endpoints

- `GET /api/categories`
- `GET /api/products`
- `GET /api/products/:slug`

`GET /api/products` supports:

- `category=<category-slug>`
- `featured=true`
- `q=<arabic-search-text>`
- `sort=featured|new|popular|price-low|price-high`
- `page=<number>`
- `limit=<1..48>`

Only active categories and `PUBLISHED` products are exposed publicly.

## Product images

Public product payloads include:

- `coverImage`
- `images`

These values are read from the `ProductImage` table. Image URLs are Cloudinary `secureUrl` values stored by the API. Existing seeded products continue to use the storefront's CSS cover fallback until an administrator uploads real images in the secure Admin Catalog patch.

No Cloudinary secret is exposed to the browser.

## Local development

The static storefront detects localhost automatically and reads the API from:

`http://127.0.0.1:4000/api`

Production uses:

`https://api.athar-online.com/api`

The API permits the local static server origins on port `8090` only outside production.

## Security boundary

Patch 028 intentionally exposes read-only catalog routes only. Product/category mutations and Cloudinary uploads will not be exposed until authenticated admin roles and the admin subdomain are in place.
