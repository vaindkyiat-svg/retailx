# Golden Path Validation (Sprint E2)

Proves the complete customer journey works end-to-end without manual database intervention.

## Question answered

> Can a brand-new shop owner receive credentials, log in, configure their shop, add inventory, make a sale, and see it reflected in reports?

## Run

Requires `.env.local` with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional admin credentials (defaults shown):

- `GOLDEN_PATH_ADMIN_EMAIL=admin@bankebihari.com`
- `GOLDEN_PATH_ADMIN_PASSWORD=Admin@12345`

```bash
# Full golden path + negative tests + reports
npm run golden-path

# Golden path only
npm run golden-path -- --golden-only

# Negative tests only
npm run golden-path -- --negative-only
```

## Golden path steps (21)

1. Admin logs in
2–3. Admin creates shop (V2 provisioning)
4. Owner receives temporary password
5–6. Owner logs in, tenant loaded
7. Dashboard data load
8–9. Add category (product string) + product
10. Add batch
11. Verify inventory
12–16. Checkout, order saved, inventory reduced
14. Print bill (simulated from order data)
17–18. Sales report + order history
19. Logout
20–21. Re-login, data persists

## Negative tests

- Duplicate email
- Duplicate shop
- Wrong password
- Expired session
- Invalid product checkout
- Out-of-stock checkout
- Rollback after provisioning failure

## Reports

Written to `reports/golden-path/`:

| File | Format |
|------|--------|
| `golden-path-*.json` | Machine-readable |
| `golden-path-*.md` | Markdown |
| `golden-path-*.html` | HTML dashboard |
| `latest.*` | Most recent run |

Each report includes: step, result, duration, errors, warnings, recommendations, and performance metrics.

## Performance metrics

- Provisioning time
- Login time
- Dashboard load
- Checkout time
- Report generation

## Known limitations

- No browser/UI automation (Playwright not included) — API-level validation mirrors app behavior
- Categories are strings on products, not a separate table
- Physical bill printing not tested
- Drawer transactions may warn if RLS blocks insert (order + inventory still validated)
- Admin login optional — provisioning uses service role if admin missing

## Integration tests

Live Supabase tests run when env is configured:

```bash
GOLDEN_PATH_LIVE=true npm run golden-path
GOLDEN_PATH_LIVE=true npm run test:infrastructure
```

Look for `Sprint E2 golden path live integration` in output.
