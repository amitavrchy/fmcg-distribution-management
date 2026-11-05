export type Actor = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  territoryId: string | null;
  distributorId: string | null;
};
export type Beat = {
  id: string;
  name: string;
  weekday: number;
  territoryId: string;
  territory: { name: string };
};
export type Outlet = {
  id: string;
  name: string;
  code: string;
  owner: string;
  phone: string;
  address: string;
  channel: string;
  beatId: string;
  beat: Beat;
  creditLimitMinor: number;
  lat: number | null;
  lng: number | null;
};
export type Sku = {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  packSize: number;
  reorderLevel: number;
};
export type Invoice = {
  id: string;
  number: string;
  outletId: string;
  totalMinor: number;
  paidMinor: number;
  status: string;
  createdAt: string;
};
export type Order = {
  id: string;
  number: string;
  outletId: string;
  distributorId: string;
  srId: string;
  status: string;
  goodsMinor: number;
  discountMinor: number;
  totalMinor: number;
  orderedAt: string;
  createdAt: string;
  notes: string;
  backorder: boolean;
  outlet: Outlet;
  sr: { id: string; fullName: string };
  lines: {
    id: string;
    skuId: string;
    sku: Sku;
    qty: number;
    unitPriceMinor: number;
    freeQty: number;
    allocatedQty: number;
    allocatedFreeQty: number;
  }[];
  delivery: {
    status: string;
    deliveredAt: string | null;
    invoice: Invoice | null;
  } | null;
};
export type Collection = {
  id: string;
  outletId: string;
  outlet: Outlet;
  sr: { fullName: string };
  amountMinor: number;
  method: string;
  status: string;
  reference: string;
  collectedAt: string;
};
export type Scheme = {
  id: string;
  name: string;
  priority: number;
  startsOn: string;
  endsOn: string;
  active: boolean;
  rules: {
    type: string;
    value?: number;
    minMinor?: number;
    skuId?: string;
    buyQty?: number;
    freeQty?: number;
    requires?: string[];
  };
};
export type Visit = {
  id: string;
  outletId: string;
  srId: string;
  callType: string;
  checkInAt: string | null;
  anomaly: boolean;
  outlet: Outlet;
  sr: { fullName: string };
};
export type Target = {
  id: string;
  srId: string;
  sr: { fullName: string };
  periodYm: string;
  targetMinor: number;
};
export type Run = {
  id: string;
  periodYm: string;
  status: string;
  results: {
    srId: string;
    fullName: string;
    salesMinor: number;
    targetMinor: number;
    achievementBps: number;
    incentiveMinor: number;
  }[];
};
export type Snapshot = {
  metrics: {
    salesMinor: number;
    monthlySalesMinor: number;
    collectedMinor: number;
    orderCount: number;
    pendingCount: number;
  };
  salesSeries: { day: string; totalMinor: number }[];
  historyLimited: boolean;
  outlets: Outlet[];
  orders: Order[];
  stock: {
    id: string;
    skuId: string;
    sku: Sku;
    qty: number;
    distributor: { id: string; name: string };
  }[];
  collections: Collection[];
  beats: Beat[];
  distributors: {
    id: string;
    name: string;
    code: string;
    territoryId: string;
  }[];
  skus: Sku[];
  prices: {
    version: number;
    name: string;
    items: { skuId: string; priceMinor: number }[];
  } | null;
  schemes: Scheme[];
  targets: Target[];
  visits: Visit[];
  users: Actor[];
  territories: {
    id: string;
    name: string;
    area: { name: string; region: { name: string } };
  }[];
  claims: {
    id: string;
    reason: string;
    amountMinor: number;
    status: string;
    order: Order;
    createdAt: string;
  }[];
  invoices: Invoice[];
  runs: Run[];
  movements: {
    id: string;
    skuId: string;
    distributorId: string;
    kind: string;
    qty: number;
    reference: string;
    createdAt: string;
  }[];
  serverTime: string;
  today: string;
  weekday: string;
};
