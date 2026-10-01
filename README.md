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

```
npm install
cp .env.example .env   # fill in Intuit sandbox keys
npm run dev
npm test
```
