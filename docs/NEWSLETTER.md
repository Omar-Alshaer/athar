# ATHR Newsletter Foundation

Patch 031 turns the footer newsletter form into a real API-backed subscription flow.

## Endpoint

`POST /api/newsletter/subscribe`

```json
{
  "email": "reader@example.com"
}
```

The endpoint normalizes the email, validates it, and upserts a `NewsletterSubscription` record in PostgreSQL.

- A new email becomes `SUBSCRIBED`.
- Re-submitting an already subscribed email is idempotent.
- A previously unsubscribed row is reactivated.
- If the email already belongs to an ATHR user, the subscription is linked to that user automatically.
- Source is currently recorded as `footer`.

The public form does not expose subscriber lists. Newsletter management/export/unsubscribe administration belongs in the protected admin dashboard patches.
