# Invoice Data Standardization Layer — Project Spec

## Thesis

A standardized invoice data network, source-captured rather than document-parsed.
Suppliers connect their accounting/billing system once (consent-based, no engineering
required on their end); consuming intermediaries (AP platforms, AR platforms,
factoring companies) get invoice data in one canonical format instead of building
and maintaining integrations to dozens of underlying systems themselves.

Not OCR. Not PDF parsing. Data is captured at the source, before it's ever rendered
into a document — so there's nothing left for a downstream system to misread.

This is an independent personal project, not an AvidXchange initiative. No
AvidXchange-sourced client or supplier data, code, or confidential process detail
is used in its design or implementation.

## Why this is defensible (and why it isn't, in the obvious version)

The naive pitch — "we save you from integrating with QuickBooks/NetSuite/etc." —
doesn't hold up against well-resourced companies. Modern accounting platforms
have documented, OAuth-based APIs; a company the size of Avid, Tipalti, or Coupa
could build a handful of these connectors in-house without much difficulty.

The real value is elsewhere:

1. **Long-tail coverage.** Two or three major platforms are a fair fight for any
   company to build in-house. Fifteen-plus — covering the platforms that make up
   only a few percent of any one buyer's supplier base each — rarely clear the
   internal prioritization bar, even for a large company. That's where an
   aggregator earns its fee.
2. **Ongoing maintenance, not initial build.** Standing up one OAuth flow is a
   sprint. Keeping dozens healthy for years — API deprecations, webhook changes,
   annual platform security re-reviews, token refresh failures — is a permanent
   operational tax that companies routinely outsource even when the underlying
   APIs are perfectly accessible.
3. **Standardization quality.** Extracting a field is easy. Deciding how a dozen
   platforms' inconsistent shapes collapse into one reliable canonical schema —
   and keeping that mapping correct as each platform evolves — is the actual
   ongoing work.

**Open question, not yet resolved:** what specifically gets a *supplier* to bother
connecting. Digitization/DSO benefits are already available to most suppliers via
existing e-invoicing tools, so that alone probably isn't enough. Likely candidates:
fewer disputed/corrected invoices, or (longer-term) not having to maintain separate
portal relationships with every buyer. Needs more thought before committing to
messaging.

## Connection models

- **Model A — supplier builds the connector.** Supplier's own team maps their data
  to the schema and pushes it. Necessary for custom/homegrown systems with no
  existing API. Higher friction, slower adoption — historically the EDI/Peppol
  pattern.
- **Model B — we build the connector, supplier just grants access.** OAuth-style
  consent flow against a platform we've already integrated (QuickBooks, NetSuite,
  etc.). Near-zero friction per supplier. **This is the v1 focus.**

**First platform: QuickBooks Online**, chosen over NetSuite for reach — Intuit
reported ~8.9M paying customers (FY2026) vs. NetSuite's ~43K organizations — and
because QBO users are already culturally used to one-click third-party app
connections.

## Canonical schema

Start from UBL / Peppol BIS Billing 3.0 (EN 16931) rather than inventing a schema
from scratch — it's already been through years of consensus-building on what an
invoice needs. Core groups to carry over:

- **Identification:** invoice number, issue date, due date, currency, type code
- **References:** PO number, contract reference, invoicing period
- **Parties:** buyer/supplier legal name, registration ID, address
- **Payment:** bank account/remit-to, payment reference, payment method
- **Line items:** description, quantity, unit price, tax category
- **Tax totals**

**TODO:** cross-check this against patterns from real invoices (sanitized/synthetic
only — see note above) to catch anything UBL doesn't cleanly cover, and to see
where real-world invoices diverge from the spec in practice. Paste common elements
here once abstracted.

## Architecture

```
/connectors/quickbooks   — OAuth + sync logic specific to QBO
/schema                  — canonical schema definition + QBO field mapping
/api                     — standardized read endpoint exposed to consumers
/docs                    — schema spec, UBL mapping notes, setup steps
```

`/connectors` as its own top-level folder from day one, even with only one
connector inside — the mapping layer and output API shouldn't need to change
when a second platform is added later.

**Core components:**
- **Connect flow** — OAuth redirect to Intuit, callback exchanges code for
  tokens, store one row per supplier (access token, refresh token, realm ID)
- **Sync engine** — webhook receiver for real-time invoice created/updated
  events, plus scheduled polling as a fallback (webhooks can be missed or late)
- **Mapping layer** — QuickBooks Invoice JSON → canonical schema
- **Storage** — normalized invoice records, keyed by supplier + invoice ID
- **Output API** — endpoint for a consuming party to fetch a supplier's
  standardized data, gated by API key to start

**Stack (default, not fixed):** TypeScript/Node backend, Postgres once past
pure prototyping (SQLite fine for the first pass).

## Milestones

1. Register Intuit developer app, spin up sandbox company, get OAuth working
   end-to-end against sandbox data
2. Pull the Invoice entity manually (no schema yet) — see QBO's raw shape firsthand
3. Draft canonical schema v1 (UBL + real-invoice patterns)
4. Write QBO → canonical mapping function, tested against sample invoice fixtures
5. Add webhook receiver for live updates
6. Build output API with basic key auth
7. Connect one real QuickBooks account end to end (own account or a friend's)
8. Only then: look at Intuit's production-keys questionnaire

## Explicitly out of scope for v1

- Remit-to/payment-address changes for factoring companies (real trust/provenance
  problem — phase 2+, needs its own design)
- Agent-native exposure (MCP, x402 micropayments) — output-side concern, layer on
  once the core data pipeline is proven
- Additional connectors beyond QuickBooks (NetSuite, Xero, Sage, custom/Model A) —
  add only after QBO end-to-end works and the schema has been stress-tested
