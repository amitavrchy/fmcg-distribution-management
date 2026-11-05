# Advanced distribution capabilities

The extension was selected against established distribution patterns: supplier procurement, batch traceability, warehouse control, direct-store delivery, field execution and settlement. SAP documents route planning/execution/settlement, van sales and batch-supported recalls. Microsoft's supply-chain documentation covers batch traceability, FEFO/safety stock and landed cost. These informed the feature map; this implementation does not claim parity with every module in those platforms. [SAP direct distribution](https://help.sap.com/docs/SAP_S4HANA_CLOUD_PE/00749a25a67e4f919f50aac370e17645/9d38c30ffbcb44f1a2e09dfe1bfa1903.html), [SAP batches](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/e322becd165844e5868e590bc8efafaf/44dd554c37a04368abea3b4077ad0f33.html), [Microsoft traceability](https://learn.microsoft.com/en-us/dynamics365/supply-chain/traceability/traceability-overview), [Microsoft safety stock](https://learn.microsoft.com/en-us/dynamics365/supply-chain/master-planning/safety-stock-replenishment).

| Area               | Implemented workflow                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Control tower      | Live inventory, supply, logistics, field and working-capital overview; exception radar; operational timeline                                                                                                       |
| Approval inbox     | Purchase, return, count and expense decisions; credit-exception link; accounts cash handovers                                                                                                                      |
| Procurement        | Supplier directory; multi-line purchase drafts; manager approval; partial/full goods receipt; lot/expiry capture; landed unit cost; supplier payables and partial payments                                         |
| Warehousing        | Multiple depots per distributor; opening stock reconciliation; FEFO paid/free reservation; stock transfers with in-transit exclusion; snapshot-based cycle counts; variance journals                               |
| Traceability       | Order allocations by batch and outlet; quarantine/expiry/recall; recalls propagate to returned lots with source lineage; blocked shipping of unsafe allocations                                                    |
| Returns            | Quantity-capped return authorization; manager review; physical receipt; restock/quarantine/scrap disposition; credits against unpaid invoice; refund liability for paid value; explicit refund payout              |
| Financial control  | Balanced posting references; AR aging by outlet terms; supplier settlement; trial balance; journal detail; approved expenses and payouts; SR cash declaration and variance acknowledgement                         |
| Delivery execution | Fleet capacity; assigned trips; nearest-neighbor geographic stop ordering; return-to-depot distance estimate; start/close controls; failure reasons; recipient and signed-challan/evidence reference; optional GPS |
| Field execution    | Merchandising, assortment, price/competitor audits and follow-up tasks; assignment, priorities, deadlines, required checklists and evidence references                                                             |
| Sales CRM          | Outlet segmentation; sales opportunity stages; expected close dates and values; pipeline board                                                                                                                     |
| Planning           | Transparent 30-day demand rate; lead/safety-day replenishment suggestions; days cover; ABC classification; expiry cost exposure; purchase drafting from recommendations                                            |
| Data operations    | CSV template, validation preview, row errors, duplicate skips and atomic outlet import; CSV exports and browser-print reports                                                                                      |
| Account security   | Password change, session-version revocation, disabled-account checks, scoped API and authenticated socket handshake                                                                                                |
| Catalog logistics  | Editable unit weight for payload checks, reorder thresholds and barcode lookup                                                                                                                                     |

## Explicit boundaries

- Geographic route ordering uses straight-line distances, not road traffic/turn-by-turn routing or a routing-provider API.
- POD/evidence references identify signed documents/photos kept by the organization. This build records references; it does not claim to upload photos to an external document store or verify a legal electronic signature.
- Replenishment uses a documented average-demand heuristic, not a trained predictive model.
- Financial journals cover implemented distribution flows. They are not a complete statutory general ledger, bank feed, payroll, tax filing or audited financial-statement system.
- Unknown historical opening-stock cost remains zero and is identified as unknown. New procurement receipts capture actual entered cost; never infer historical purchase costs from retail prices.
- Inventory valuation includes costed free/held warehouse stock, reserved allocations and in-transit stock. Integer-unit freight rounding residue is posted explicitly, so full supplier liabilities are retained.
- Advanced procurement/settlement operations require connectivity. Existing SR order/collection offline sync remains available.
- Sync cash collections before handing over a business day. Handovers are scoped per SR, distributor and Dhaka date; later cash for a closed day is flagged for accounts review.
- No live bKash/Nagad/bank, S3, SMS, SMTP, ERP or map-provider credentials are configured. Multi-company tenancy, manufacturing/MRP, supplier EDI, live traffic routing, native mobile apps and retailer self-service are separate product scope.

## Folder and CI contract

The repository root has `frontend/`, `backend/`, and necessary hidden `.git` metadata. Docker Compose, docs, source, scripts, E2E tests, Playwright configuration, lock files and artifacts live inside those two folders.

Run `node backend/scripts/verify.mjs --browser` from the root after setup. It validates structure, migrations, seeds, types, database tests, production builds, dependency audits and browser acceptance. It can supervise the production servers it starts and leaves pre-existing servers alone.

GitHub only automatically discovers workflows in root `.github/workflows`. That folder conflicts with the requested two-folder root, so the former workflow is retained under `backend/ci` as an external-runner example, not represented as active GitHub Actions. Use the portable verification runner from your CI provider, or restore root workflow discovery if the folder constraint is later changed.
