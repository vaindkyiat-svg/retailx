# Infrastructure tests — RetailX POS V2

## Layout

```
tests/
├── unit/
│   ├── infrastructure.test.mjs   # Migrations, seeds, folder structure
│   └── feature-flags.test.mjs      # Flag resolution logic
└── integration/
    └── database.test.mjs           # Requires DATABASE_URL
```

## Running

```bash
npm test
# or
node scripts/infrastructure/test.mjs
```

Integration tests are skipped when `DATABASE_URL` is not set.

## CI

See `.github/workflows/infrastructure.yml` for automated validation on PRs and integration tests on `main`.
