# API reference

Base `/api`, JSON. Authentication uses the HttpOnly session cookie. Browser mutations require allowed origins. Errors: 401 unauthenticated, 403 unauthorized, 400 invalid, 409 conflict, with `message` and `statusCode`.

| Method | Path                                        | Input / purpose                                                                 |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------- |
| POST   | /auth/login                                 | Email, password; 12-hour cookie                                                 |
| GET    | /auth/me                                    | Safe current account                                                            |
| POST   | /auth/logout                                | Clear cookie                                                                    |
| GET    | /snapshot, /dashboard                       | Scoped records, full-history metrics, sales series                              |
| GET    | /orders?page=1&q=&status=ALL&delivery=false | Search history, 25/page                                                         |
| GET    | /sr/today-beat                              | Cached scoped route snapshot                                                    |
| GET    | /audit                                      | Admin full history; manager own activity                                        |
| POST   | /masters/outlets                            | Name, code, owner, phone, address, beatId, channel, creditLimitMinor            |
| PATCH  | /outlets/:id                                | BeatId, optional creditLimitMinor                                               |
| POST   | /masters/beats                              | Name, territoryId, weekday (Sunday=0)                                           |
| POST   | /masters/distributors                       | Name, code, territoryId                                                         |
| POST   | /masters/skus                               | Name, code, category, unit, packSize, reorderLevel, priceMinor                  |
| POST   | /masters/schemes                            | Name, priority, startsOn, endsOn, rules                                         |
| POST   | /admin/users                                | Email, fullName, password (12+), role, territoryId, distributorId when required |
| POST   | /admin/territories                          | Region, area, name                                                              |
| POST   | /admin/prices                               | SkuId, priceMinor; publish next version                                         |
| POST   | /stock/receive                              | DistributorId, skuId, qty, reference                                            |
| POST   | /orders/preview                             | Order input, calculate without persistence                                      |
| POST   | /orders                                     | Idempotent submission                                                           |
| PATCH  | /orders/:id/status                          | Status; enforced lifecycle                                                      |
| POST   | /collections                                | OutletId, amountMinor, method, reference, clientCollectionId                    |
| PATCH  | /collections/:id/status                     | RECONCILED or BOUNCED                                                           |
| POST   | /sr/visits                                  | OutletId, callType, lat, lng, notes                                             |
| POST   | /targets                                    | SrId, periodYm, targetMinor, optional focusSkuJson SKU array                    |
| POST   | /incentives/runs                            | PeriodYm                                                                        |
| PATCH  | /incentives/runs/:id                        | APPROVED or PAID                                                                |
| POST   | /claims                                     | OrderId, reason, amountMinor                                                    |
| PATCH  | /claims/:id                                 | APPROVED or REJECTED                                                            |
| GET    | /sync/pull?since=                           | Full replacement snapshot                                                       |
| POST   | /sync/push                                  | Up to 100 independent ORDER/COLLECTION items                                    |

Order body, substituting actual IDs:

```json
{
  "clientOrderId": "343a7e9b-6c20-4e51-b2e8-edcfc4923908",
  "outletId": "outlet-id",
  "distributorId": "distributor-id",
  "priceListVersion": 1,
  "orderedAt": "2026-11-05T06:00:00.000Z",
  "lines": [{ "skuId": "sku-id", "qty": 12 }]
}
```

Server determines prices. Reusing UUIDs returns the creator's original record. Stale prices return `PRICE_STALE`. Excess credit creates `PENDING_APPROVAL`; managers override at confirmation.

Scheme rules: `PERCENT {value,minMinor}`, `AMOUNT {value,minMinor}`, `FREE {skuId,buyQty,freeQty}`, `COMBO {requires:[skuIds],value,minMinor}`. Value is percent for PERCENT, paisa for AMOUNT/COMBO.

Sync: `{items:[{id:UUID,type:"ORDER",payload:orderBody}]}` → `{results:[{id,ok,data?,error?}]}`. Retain failed items and preserve their client IDs when retrying.

Socket.IO authenticates the cookie and session version. `refresh` contains only a timestamp. Admin, manager-territory and originating-user rooms fetch authorized snapshots.

## Advanced operations

The `/api/enterprise` prefix exposes the advanced workflows. `GET /snapshot` returns authorized warehouse, procurement, finance, return, trip, task, opportunity and analytics records. SR financial visibility is limited; server scopes are enforced independently of navigation.

| Method       | Path under /enterprise             | Purpose                                                            |
| ------------ | ---------------------------------- | ------------------------------------------------------------------ |
| POST         | /warehouses                        | Create distributor warehouse                                       |
| PATCH        | /batches/:id                       | Disposition plus reason: AVAILABLE, QUARANTINED, RECALLED, EXPIRED |
| POST / PATCH | /transfers, /transfers/:id         | Request, approve dispatch, receive or cancel warehouse transfer    |
| POST / PATCH | /counts, /counts/:id               | Snapshot physical count, approve/reject variance                   |
| POST         | /suppliers                         | Supply partner with terms                                          |
| POST / PATCH | /purchases, /purchases/:id         | Purchase draft, approval or cancellation                           |
| POST         | /purchases/:id/receive             | Idempotent GRN with warehouse, quantities, lots and expiry         |
| POST         | /payables/:id/pay                  | Idempotent supplier payment                                        |
| POST / PATCH | /returns, /returns/:id             | Quantity-capped authorization and review                           |
| POST         | /returns/:id/receive               | Physical receipt, credit posting and refund liability              |
| POST         | /credits/:id/refund                | Pay the recorded refund liability                                  |
| POST / PATCH | /expenses, /expenses/:id           | Expense submission and review                                      |
| POST         | /expenses/:id/pay                  | Pay approved liability                                             |
| POST         | /handovers                         | Cash day declaration by partner                                    |
| POST         | /handovers/:id/receive             | Accounts acknowledgement and variance posting                      |
| POST         | /vehicles                          | Fleet capacity record                                              |
| POST / PATCH | /trips, /trips/:id                 | Plan, start, close or cancel trip                                  |
| PATCH        | /stops/:id                         | Delivered recipient/POD reference or failure reason, optional GPS  |
| POST         | /tasks                             | Assign typed task and checklist                                    |
| POST         | /tasks/:id/complete                | All checklist results and evidence reference                       |
| POST / PATCH | /opportunities, /opportunities/:id | Opportunity creation and stage transition                          |
| POST         | /imports/outlets/preview           | CSV validation and row-level errors/skips                          |
| POST         | /imports/outlets/apply             | Revalidate and atomically import valid file                        |

`POST /api/auth/password` checks the current password and changes to a 12+ character password, revoking other sessions. `PATCH /api/admin/users/:id` changes account role/state/scope and revokes existing sessions; the last administrator is protected. Collection inputs additionally accept `collectedAt` for original offline timing, limited to seven days.
