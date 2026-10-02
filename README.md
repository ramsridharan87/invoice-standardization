# Invoice Connector

Source-captured invoice data standardization layer. Suppliers connect their
accounting system once; consumers get invoices in one canonical format.

See [invoice-connector-spec.md](invoice-connector-spec.md) for the full spec.

## Layout

```
src/connectors/quickbooks   OAuth + sync logic specific to QBO
src/schema                  canonical schema + per-connector mappings
src/api                     standardized read endpoint for consumers
docs/                       schema spec, UBL mapping notes, setup steps
test/                       tests and invoice fixtures
```

## Getting started

Requires Node 24+ (uses the built-in `node:sqlite`).

```
npm install
cp .env.example .env   # fill in Intuit sandbox keys
npm run dev
npm test
```

## Connecting a QuickBooks sandbox company

1. In the Intuit developer portal, add `http://localhost:3000/connect/quickbooks/callback`
   as a redirect URI on the app's Development keys.
2. `npm run dev`, open http://localhost:3000, click **Connect to QuickBooks**, and pick
   the sandbox company.
3. Back on the home page, follow **raw invoices** to see QBO's unmodified Invoice JSON.

The server binds to 127.0.0.1 only — the `/dev` routes return supplier data without auth.
