# ATHR Secure Digital Delivery — Patch 035

## Storage model

Product cover/gallery images stay on Cloudinary. Purchased PDF/EPUB files are stored separately in private server storage and never receive a public URL.

Configure production with an absolute server path:

```env
DIGITAL_STORAGE_ROOT=/var/lib/athr/private
```

The default development path is `.private-storage` under the API process working directory and is ignored by Git.

## Admin flow

`POST /api/admin/products/:id/digital-file` accepts one PDF or EPUB up to 80 MB. Replacing a file deletes the previous private object after the database update succeeds.

`DELETE /api/admin/products/:id/digital-file` removes the private object and clears its metadata.

## Customer download flow

`GET /api/commerce/library/:libraryItemId/download`

The endpoint requires the authenticated customer session and verifies:

1. The library grant belongs to the current user.
2. The grant has not been revoked.
3. A private file is attached to that product.
4. The private file still exists inside the configured storage root.

The filesystem key is never returned to the storefront. Every successful authorized download request creates a `DownloadLog` record.

The response is attachment-only with `no-store` caching and `nosniff` headers.
