# FMCG Distribution Management — Project Spec

> Stack: **Next.js (SR PWA) + NestJS + Prisma + PostgreSQL + Redis/BullMQ + Socket.IO**  
> Bangladesh FMCG distribution: SR order app, routes/beats, dealer-distributor stock, secondary sales, collection, targets/incentives, offline sync.

---

## 1. Overview & Goals

### Product
Manage primary (company→distributor) and secondary (distributor→retailer) sales. Sales Representatives (SR) take orders on beats/routes, deliver/invoice, collect cash/bKash, and hit targets with incentive schemes. Works offline in low-connectivity upazilas.

### Engineering goals
- Beat calendar & journey plan compliance.
- Secondary order → allocation → delivery → collection chain.
- Stock at distributor warehouse with batch optional.
- Target vs achievement + incentive calculation engine.
- Offline-first SR app with idempotent sync.

### Non-goals
- Full modern trade modern-POS integration (CSV/API stub).
- Manufacturing planning.

---

## 2. User Roles & Permissions (RBAC)

| Role | Scope |
|------|-------|
| `COMPANY_ADMIN` | SKUs, price lists, schemes, territories |
| `AREA_MANAGER` | Distributors, SR team, approvals |
| `DISTRIBUTOR` | Own stock, confirm orders, delivery, claims |
| `SR` | Beat outlets, orders, collections |
| `ACCOUNTS` | Collection reconcile, credit limits |
| `RETAILER` (optional lite) | Order history |

Territory hierarchy: Region → Area → Territory → Beat.

---

## 3. Feature Modules

1. Geo hierarchy & beats  
2. Outlets/retailers with geo & channel (general/pharmacy/hotel)  
3. SKU, price lists, schemes (discount/free goods)  
4. Distributor stock & primary invoices  
5. SR journey plan & attendance (check-in GPS)  
6. Secondary orders & deliveries  
7. Collections & credit  
8. Targets & incentives  
9. Claims/returns  
10. Offline sync & dashboards  

---

## 4. Advanced Business Logic

### 4.1 Beat & journey plan
- Weekly beat template; SR must visit planned outlets (geo fence optional).
- `callType`: ORDER / NO_ORDER / CLOSED / PRODUCTIVE.
- Perfect call rate = productive calls / planned.

### 4.2 Scheme engine
Rule types: `% off invoice`, amount off, free SKU on qty slabs, combo.
Apply deterministically by priority; stock check free goods at distributor.

### 4.3 Order → delivery
```
ORDERED → CONFIRMED → ALLOCATED → DISPATCHED → DELIVERED | CANCELLED
Allocation reduces distributor stock; short supply → partial delivery + backorder flag
```

### 4.4 Collection & credit
- Outlet credit limit; block order if outstanding + new > limit unless AM approves.
- Collection allocates FIFO to invoices.
- Modes: cash, bKash, Nagad, cheque (clearing state).

### 4.5 Targets & incentives
```
achievement% = secondarySalesValue / targetValue
incentive = slabs(achievement%) * weight + productiveCallBonus + SKU focus bonus
```
Run monthly; lock after approval.

### 4.6 Offline sync
- Orders/collections with `clientId` UUID; server idempotent.
- Price list version vector; if SR stale → force refresh before new order.
- Conflict: credit limit exceeded at sync → `PENDING_APPROVAL`.

### 4.7 Edge cases
- Outlet transferred across beats mid-month.  
- Scheme end date during offline day — server validates `orderedAt`.  
- Duplicate delivery against same order.  
- GPS spoof signals: store raw, flag anomalies.  
- Primary vs secondary stock mismatch claims.

---

## 5. State Machines

**SecondaryOrder**: `DRAFT → SUBMITTED → CONFIRMED → ALLOCATED → DISPATCHED → DELIVERED | CANCELLED | PENDING_APPROVAL`  
**Delivery**: `PLANNED → DONE | PARTIAL | FAILED`  
**Collection**: `POSTED → RECONCILED | BOUNCED` (cheque)  
**IncentiveRun**: `DRAFT → CALCULATED → APPROVED → PAID`  
**JourneyDay**: `PLANNED → IN_PROGRESS → CLOSED`

---

## 6. Prisma Schema Draft

```prisma
model Company { id String @id @default(cuid()) name String }
model Region { id String @id @default(cuid()) name String }
model Area { id String @id @default(cuid()) regionId String name String }
model Territory { id String @id @default(cuid()) areaId String name String }
model Beat {
  id String @id @default(cuid())
  territoryId String
  name String
  weekday Int // 0-6
}
model User {
  id String @id @default(cuid())
  role String
  fullName String
  phone String? @unique
  territoryId String?
  distributorId String?
  passwordHash String?
}
model Distributor {
  id String @id @default(cuid())
  code String @unique
  name String
  territoryId String
  creditLimitMinor Int @default(0)
}
model Outlet {
  id String @id @default(cuid())
  code String
  name String
  beatId String
  channel String?
  lat Float?
  lng Float?
  creditLimitMinor Int @default(0)
  @@unique([beatId, code])
}
model Sku {
  id String @id @default(cuid())
  code String @unique
  name String
  unit String
  packSize Int @default(1)
}
model PriceList {
  id String @id @default(cuid())
  name String
  version Int
  active Boolean @default(true)
}
model PriceListItem {
  id String @id @default(cuid())
  priceListId String
  skuId String
  priceMinor Int
  @@unique([priceListId, skuId])
}
model Scheme {
  id String @id @default(cuid())
  name String
  priority Int @default(100)
  startsOn DateTime @db.Date
  endsOn DateTime @db.Date
  rules Json
  active Boolean @default(true)
}
model DistributorStock {
  id String @id @default(cuid())
  distributorId String
  skuId String
  qty Decimal @db.Decimal(14,3)
  @@unique([distributorId, skuId])
}
model SecondaryOrder {
  id String @id @default(cuid())
  distributorId String
  outletId String
  srId String
  status String
  clientOrderId String @unique
  priceListVersion Int
  goodsMinor Int
  discountMinor Int
  totalMinor Int
  orderedAt DateTime
}
model SecondaryOrderLine {
  id String @id @default(cuid())
  orderId String
  skuId String
  qty Decimal @db.Decimal(14,3)
  unitPriceMinor Int
  freeQty Decimal @db.Decimal(14,3) @default(0)
}
model Delivery {
  id String @id @default(cuid())
  orderId String @unique
  status String
  deliveredAt DateTime?
}
model Invoice {
  id String @id @default(cuid())
  outletId String
  deliveryId String @unique
  totalMinor Int
  paidMinor Int @default(0)
  status String
}
model Collection {
  id String @id @default(cuid())
  outletId String
  srId String
  amountMinor Int
  method String
  clientCollectionId String @unique
  collectedAt DateTime
}
model CollectionAllocation {
  id String @id @default(cuid())
  collectionId String
  invoiceId String
  amountMinor Int
}
model JourneyVisit {
  id String @id @default(cuid())
  srId String
  outletId String
  beatDate DateTime @db.Date
  callType String
  checkInAt DateTime?
  lat Float?
  lng Float?
  @@unique([srId, outletId, beatDate])
}
model Target {
  id String @id @default(cuid())
  srId String?
  distributorId String?
  periodYm String // 2026-11
  targetMinor Int
  focusSkuJson Json?
}
model IncentiveRun {
  id String @id @default(cuid())
  periodYm String
  status String
}
model IncentiveResult {
  id String @id @default(cuid())
  runId String
  srId String
  achievementBps Int
  incentiveMinor Int
  breakdown Json
}
```

---

## 7. REST API

- Master data: territories, beats, outlets, SKUs, prices, schemes  
- `GET /sr/today-beat`  
- `POST /sr/visits`  
- `POST /orders` + scheme preview  
- Distributor confirm/allocate/deliver  
- `POST /collections`  
- Targets CRUD; `POST /incentives/runs`  
- `POST /sync/push`, `GET /sync/pull?since=`  
- Dashboards for AM  

---

## 8. Real-time

- AM board: SR check-ins, order feed (`territory:{id}`).

---

## 9. Jobs

- Daily journey plan materialization  
- Scheme expiry  
- Monthly incentive calculate  
- Credit overdue alerts  
- Stock low at distributor  

---

## 10. Security

- SR scoped to territory/beats.  
- Distributor sees only own stock/orders.  
- Idempotency keys on order/collection.  
- Soft fraud flags on GPS anomalies.

---

## 11. Caching

- Price list version in Redis.  
- Today beat outlet list per SR.

---

## 12. Testing

- Scheme slab free-goods math.  
- Credit limit block + AM override path.  
- Offline duplicate clientOrderId.  
- Partial delivery stock movements.  
- Incentive slab fixtures.

---

## 13. Folder Structure

```
fmcg-distribution-management/
  Project_spec.md
  frontend/  # SR PWA + distributor + company admin
  backend/
```

---

## 14. Env vars

`DATABASE_URL`, `REDIS_URL`, `JWT_*`, `APP_URL`, `CORS_ORIGINS`, `S3_*`, `SMTP_URL`, `SMS_*`, `GEO_FENCE_METERS`, `OFFLINE_MAX_HOURS`, `PRICE_LIST_FORCE_REFRESH`, `DEFAULT_CREDIT_LIMIT_MINOR`

---

## 15. Milestones

1. Hierarchy, outlets, SKUs, price lists  
2. Distributor stock + secondary order happy path  
3. Schemes  
4. Delivery + collection + credit  
5. Journey plan + GPS visits  
6. Offline sync  
7. Targets/incentives + dashboards  

---

## 16. Acceptance Criteria

- [ ] SR can complete beat order offline and sync once.
- [ ] Free-goods scheme allocates only if distributor stock available.
- [ ] Credit limit enforced at confirm/sync.
- [ ] Collection FIFO reduces oldest invoices.
- [ ] Incentive run matches slab fixtures.
- [ ] AM cannot see other region data.
- [ ] Seed: 1 territory, 2 beats, 1 distributor, 30 outlets, 20 SKUs.

---

## 17. Agent Notes

- `SchemeEngine.preview(cart)` pure.  
- Large tap UI for SR phones.  
- Store all money in paisa BDT.
