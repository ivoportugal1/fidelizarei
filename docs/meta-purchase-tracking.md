# Meta Purchase tracking

The Fidelizarei purchase conversion is sent server-side through Meta Conversions API. There is no browser `Purchase` call and no purchase event on signup, login, checkout opening, billing-page return, or dashboard access.

## Trigger

The event is eligible only when Stripe sends `invoice.paid` or `invoice.payment_succeeded` for an invoice with all of these properties:

- `billing_reason = subscription_create`;
- `paid = true` and `status = paid`;
- `amount_paid > 0`;
- the organization opted in to purchase measurement during signup.

`value` comes from `invoice.amount_paid`, converted from Stripe's minor unit, and `currency` comes from `invoice.currency`. Renewals (`subscription_cycle`), trials/coupons with no payment, Checkout returns, and duplicate webhook deliveries do not create another Purchase.

## Required environment variables

Configure these in the deployment environment only after the code has been reviewed:

```text
META_PURCHASE_TRACKING_ENABLED=true
META_PIXEL_ID=<numeric ID of the "site fidelizarei" data source>
META_CONVERSIONS_API_ACCESS_TOKEN=<token generated for that same data source>
```

Never commit the access token. The integration uses Graph API `v26.0` and sends the token in the encrypted request body, not in application logs or a public URL.

For validation, temporarily add the code shown in **Events Manager > Data sources > site fidelizarei > Test events**:

```text
META_TEST_EVENT_CODE=<TEST... code>
```

Remove `META_TEST_EVENT_CODE` before live validation. A Stripe test-mode invoice is never sent to Meta unless this test code is present.

## Safe validation without a real charge

1. Use Stripe sandbox/test keys and test Price IDs in a non-production Vercel project.
2. Configure the sandbox Stripe webhook to send `invoice.paid` (and optionally `invoice.payment_succeeded`) to `/api/billing/webhook/stripe`.
3. Set the Meta Test Events code in `META_TEST_EVENT_CODE`.
4. Create a new sandbox signup, opt in to purchase measurement, and pay with Stripe's successful test card `4242 4242 4242 4242` using any future expiry/CVC.
5. In Meta Events Manager, open **Test events** and confirm one server event named `Purchase` with the Stripe invoice ID as `event_id`, the sandbox invoice's amount, and its uppercase currency.
6. Resend the same Stripe webhook and refresh the billing/dashboard pages. The `Purchase` count must remain one.
7. Trigger a renewal invoice (Stripe Test Clock is suitable) and confirm no second Purchase is emitted.
8. Repeat with consent unchecked and confirm no Meta event is emitted.

The database table `meta_purchase_events` keeps the stable event ID and delivery state. If Meta accepts an event but the response is lost, a retry uses the same event ID, allowing Meta to deduplicate it.
