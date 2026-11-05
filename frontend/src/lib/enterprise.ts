import type { Order, Sku } from "./types";
export type Warehouse = {
  id: string;
  code: string;
  name: string;
  distributorId: string;
  address: string;
  lat: number;
  lng: number;
  active: boolean;
  distributor: { name: string };
};
export type Batch = {
  originBatchIds: string[];
  id: string;
  warehouseId: string;
  skuId: string;
  lot: string;
  qty: number;
  unitCostMinor: number;
  expiresOn: string | null;
  status: string;
  receivedAt: string;
  sku: Sku;
  warehouse: Warehouse;
  allocations: {
    id: string;
    qty: number;
    freeQty: number;
    orderLine: { order: Order };
  }[];
};
export type Supplier = {
  id: string;
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string | null;
  paymentTermsDays: number;
  active: boolean;
};
export type PurchaseLine = {
  id: string;
  skuId: string;
  sku: Sku;
  qty: number;
  receivedQty: number;
  unitCostMinor: number;
};
export type Purchase = {
  id: string;
  number: string;
  supplierId: string;
  distributorId: string;
  status: string;
  expectedOn: string;
  freightMinor: number;
  taxBps: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  supplier: Supplier;
  distributor: { name: string };
  lines: PurchaseLine[];
  receipts: {
    id: string;
    number: string;
    createdAt: string;
    lines: { qty: number; costMinor: number }[];
  }[];
  payable: Payable | null;
};
export type Payable = {
  id: string;
  purchaseId: string;
  totalMinor: number;
  paidMinor: number;
  dueOn: string;
  purchase: Purchase;
  payments: {
    id: string;
    amountMinor: number;
    method: string;
    reference: string;
    createdAt: string;
  }[];
};
export type Transfer = {
  id: string;
  number: string;
  batchId: string;
  targetWarehouseId: string;
  qty: number;
  status: string;
  createdAt: string;
  batch: Batch;
};
export type Count = {
  id: string;
  number: string;
  warehouseId: string;
  warehouse: Warehouse;
  status: string;
  notes: string;
  lines: {
    id: string;
    expectedQty: number;
    countedQty: number;
    batch: Batch;
  }[];
  createdAt: string;
};
export type Credit = {
  id: string;
  number: string;
  amountMinor: number;
  appliedMinor: number;
  refundMinor: number;
  refundPaid: boolean;
  createdAt: string;
};
export type ReturnRequest = {
  id: string;
  number: string;
  orderId: string;
  order: Order;
  reason: string;
  status: string;
  createdAt: string;
  lines: {
    id: string;
    qty: number;
    freeQty: number;
    disposition: string;
    orderLine: { sku: Sku };
  }[];
  credit: Credit | null;
};
export type Journal = {
  id: string;
  reference: string;
  description: string;
  distributorId: string;
  lines: { account: string; debitMinor: number; creditMinor: number }[];
  createdAt: string;
};
export type Expense = {
  id: string;
  distributorId: string;
  category: string;
  amountMinor: number;
  description: string;
  receiptReference: string;
  status: string;
  createdBy: string;
  createdAt: string;
};
export type Handover = {
  id: string;
  srId: string;
  distributorId: string;
  businessDate: string;
  expectedMinor: number;
  declaredMinor: number;
  status: string;
  discrepancyReason: string;
};
export type Vehicle = {
  id: string;
  name: string;
  registration: string;
  distributorId: string;
  capacityKg: number;
  active: boolean;
};
export type Stop = {
  id: string;
  orderId: string;
  order: Order;
  sequence: number;
  status: string;
  recipientName: string | null;
  proofReference: string | null;
  lat: number | null;
  lng: number | null;
  note: string;
  completedAt: string | null;
};
export type Trip = {
  id: string;
  number: string;
  distributorId: string;
  warehouseId: string;
  vehicleId: string;
  driverId: string;
  scheduledOn: string;
  status: string;
  distanceKm: number;
  loadKg: number;
  warehouse: Warehouse;
  vehicle: Vehicle;
  stops: Stop[];
};
export type Task = {
  id: string;
  title: string;
  type: string;
  outletId: string;
  outlet: { name: string; address: string };
  assignedTo: string;
  dueOn: string;
  priority: string;
  status: string;
  checklist: string[];
  result: { checks: boolean[]; notes: string } | null;
  evidenceReference: string | null;
};
export type Opportunity = {
  id: string;
  outletId: string;
  assignedTo: string;
  territoryId: string;
  title: string;
  valueMinor: number;
  stage: string;
  expectedOn: string;
  notes: string;
};
export type ProductInsight = {
  skuId: string;
  skuName: string;
  distributorId: string;
  onHand: number;
  sold: number;
  valueMinor: number;
  dailyDemand: number;
  daysCover: number | null;
  suggestedQty: number;
  classification: string;
};
export type EnterpriseSnapshot = {
  warehouses: Warehouse[];
  batches: Batch[];
  suppliers: Supplier[];
  purchases: Purchase[];
  transfers: Transfer[];
  counts: Count[];
  returns: ReturnRequest[];
  payables: Payable[];
  journals: Journal[];
  trialBalance: {
    account: string;
    debitMinor: number;
    creditMinor: number;
    balanceMinor: number;
  }[];
  expenses: Expense[];
  handovers: Handover[];
  vehicles: Vehicle[];
  trips: Trip[];
  tasks: Task[];
  opportunities: Opportunity[];
  aging: {
    id: string;
    number: string;
    outletId: string;
    outletName: string;
    outstandingMinor: number;
    createdAt: string;
    days: number;
    bucket: string;
  }[];
  products: ProductInsight[];
  expiry: {
    id: string;
    lot: string;
    skuName: string;
    warehouseName: string;
    qty: number;
    daysLeft: number;
    valueMinor: number;
  }[];
  summary: {
    inventoryValueMinor: number;
    quarantinedUnits: number;
    openPurchaseCount: number;
    payableMinor: number;
    receivableMinor: number;
    overdueMinor: number;
    pendingRefundMinor: number;
    openTasks: number;
    lateTasks: number;
    activeTrips: number;
    pipelineMinor: number;
  };
  today: string;
};
