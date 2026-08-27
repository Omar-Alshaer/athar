# ATHR Admin Catalog — Patch 033

Patch 033 turns the protected admin subdomain into the source of truth for catalog management.

## Admin catalog endpoints

All routes require a valid admin session cookie and an `ADMIN` or `SUPER_ADMIN` role.

### Categories

- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PATCH /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`

A category with products cannot be hard-deleted; disable it instead.

### Products

- `GET /api/admin/products`
- `GET /api/admin/products/:id`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `DELETE /api/admin/products/:id`

A product with order or library history cannot be hard-deleted; archive it instead. Public catalog routes continue to expose only `PUBLISHED` products in active categories.

### Product images

- `POST /api/admin/products/:id/images/cover`
- `POST /api/admin/products/:id/images/gallery`
- `DELETE /api/admin/products/:productId/images/:imageId`

The upload field name is `image`. Accepted image MIME types are JPEG, PNG, WEBP and AVIF, with an 8 MB limit per image. Gallery uploads are capped at ten images per product.

Cloudinary credentials stay server-side. The admin browser sends the file to the ATHR API, and only the API communicates with Cloudinary.

## Cloudinary local setup

Set these values in the root `.env` and restart `npm run dev:api`:

```env
CLOUDINARY_CLOUD_NAME=replace_me
CLOUDINARY_API_KEY=replace_me
CLOUDINARY_API_SECRET=replace_me
CLOUDINARY_FOLDER=athar-online
```

Do not commit the real values.

## Audit log

Create/update/delete and image operations write an `AdminAuditLog` row with the acting admin user, action, entity, and limited metadata.
