# ATHR Full Regression Gate

Run this gate **before XPay** and again after the XPay sandbox integration.

## Local stack

The regression runner now starts any missing local service itself after build. If API/Admin/Storefront are already running, it reuses them and does not stop them.

Manual startup is optional:

Terminal 1:

```bash
cd /mnt/Work/athr-store
npm run dev:api
```

Terminal 2:

```bash
cd /mnt/Work/athr-store
npm run dev:admin
```

Terminal 3:

```bash
cd /mnt/Work/athr-store
python3 -m http.server 8090 --bind 127.0.0.1
```

## Automated regression

Terminal 4:

```bash
cd /mnt/Work/athr-store
python3 tools/qa/full-regression.py
```

The script asks for the admin password without showing it on screen.

It creates temporary QA-only data, tests the complete mock purchase/download path,
then cleans its customer, order, newsletter, product, Cloudinary image, private file,
and category.

Expected result:

```text
ATHR QA RESULT: PASS
```


## Pass criteria

`ATHR QA RESULT: PASS` is valid only if the runner also reaches:

```text
PASS  Full E2E scenario completed
```

The runner must fail if any E2E request throws an error or if the scenario exits
before customer logout/session rejection is verified.


## Manual browser / visual regression

Automation does not catch CSS layering, responsive overflow, visual clipping, modal
stacking, or browser localStorage UX. Test the following in desktop and around 430px
mobile width.

### Storefront
- Home, Shop, Product, Cart, Checkout all open with no browser console errors.
- Fixed navbar stays visible while scrolling.
- Mobile menu opens/closes and does not hide behind page content.
- Account, wishlist, cart and search icons are clickable.
- Products come from the API and product details match.
- Add to cart persists after refresh.
- Quantity +/- and remove work.
- Cart and checkout do not overflow on mobile.

### Customer account
- Register.
- Refresh keeps session.
- Logout.
- Login again.
- Account icon opens the account.
- Orders and Library render correctly.

### Wishlist
- Logged-out favorite persists through localStorage after refresh.
- Login merges guest favorites into the DB wishlist.
- Wishlist page works.
- Remove favorite updates the icon/count.

### Newsletter
- Subscribe from footer.
- Success/error state is visible.
- Duplicate email does not create a second subscription.

### Admin
- Login screen disappears after successful login.
- Refresh keeps admin session.
- Dashboard loads.
- Products and categories load.
- Add/edit/publish/archive product.
- Add/edit category.
- Cloudinary cover upload/replace/delete.
- Private PDF upload/delete.
- Admin modals fit mobile height and scroll correctly.

### Commerce / library
- Login as customer.
- Cart -> Checkout -> mock hosted payment.
- Paid order appears in customer account and admin.
- Purchased book appears in Library.
- Owner download succeeds.
- Incognito / logged-out direct download URL fails.

## Still required before production

- XPay sandbox E2E and signed webhook tests.
- XPay cancel/failure/duplicate webhook/idempotency tests.
- Password reset.
- Email verification.
- Admin user management (suspend/activate) and newsletter actions/export.
- Production HTTPS, subdomains, cookie/CORS tests.
- PostgreSQL backup + restore rehearsal.
- Production secrets outside Git.
- Disable mock payments in production.
