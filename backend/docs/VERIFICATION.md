# Verification record

Verified locally on 5 November 2026, Asia/Dhaka, using Node 24, PostgreSQL 17, Redis 7 and Chrome.

- Both TypeScript workspaces and production builds pass.
- 20 pure domain tests and two database acceptance tests pass (22 total).
- Database acceptance passes: cross-region isolation; concurrent duplicate creation; credit block/override; partial/free-stock shortage; concurrent delivery/unique invoice; FIFO; duplicate collections; cheque clearing; overpayment rejection; cancellation restoration.
- Fourteen browser/API tests pass against production builds: session rotation/disabled access, anonymous/origin rejection, stale pricing/idempotency/role boundaries, every standard and advanced route, order creation/preview, procurement approval/receipt/payment, field checklist evidence, returns/credit posting, mobile navigation/overflow, offline reconnect, GPS and accessibility across the control tower, procurement, warehouse, finance and field screens.
- Content font-size checks pass at every operational route (minimum 14px); chart labels compensate for SVG scaling.
- Both standalone application dependency audits report zero vulnerabilities.
- The portable verification runner passes structure, migration/seeds, types, tests, builds, audits and supervised production-server/browser checks.

Tests are in backend/test and backend/e2e. Advanced database acceptance additionally covers GRN idempotency, landed-cost rounding, FEFO, payload/route execution, POD, quantity-capped returns, credit/refunds, transfer/count adjustments, recall propagation, CSV import, scoped visibility, cash-day closure and balanced journals. SQL check constraints reject invalid stock/balance writes.

Production hosting, live payment/SMS, road-routing APIs and load testing were not verified. POD/evidence references identify external company records; they do not represent an implemented media-upload service. See capability boundaries in ADVANCED_CAPABILITIES.md. Automatic root GitHub Actions discovery is disabled by the required two-folder root; the external-runner example and portable verification script are inside backend.
