"use client";
import { useState } from "react";
import { Plus, Download } from "lucide-react";
import { AppProvider, useApp } from "./provider";
import { Shell } from "./shell";
import { Overview } from "./overview";
import { OrderComposer } from "./order-composer";
import { Orders } from "./orders";
import { Outlets } from "./outlets";
import { Inventory } from "./inventory";
import { Collections } from "./collections";
import { Beats } from "./beats";
import { Schemes } from "./schemes";
import { Targets } from "./targets";
import { Claims } from "./claims";
import { Team } from "./team";
import { SyncCenter } from "./sync-center";
import { Settings } from "./settings";
const meta: Record<
  string,
  { title: string; description: string; action?: string; roles?: string[] }
> = {
  orders: {
    title: "Orders",
    description: "From first order to the last mile. Keep every sale moving.",
    action: "New order",
    roles: ["COMPANY_ADMIN", "AREA_MANAGER", "SR"],
  },
  deliveries: {
    title: "Deliveries",
    description: "A clear view of what’s allocated, on the road and delivered.",
  },
  outlets: {
    title: "Your retail network",
    description: "Stronger relationships start with knowing every outlet.",
    action: "Add outlet",
    roles: ["COMPANY_ADMIN", "AREA_MANAGER"],
  },
  inventory: {
    title: "Inventory",
    description: "The right stock, in the right place, at the right time.",
    action: "Receive stock",
    roles: ["COMPANY_ADMIN", "AREA_MANAGER", "DISTRIBUTOR"],
  },
  catalog: {
    title: "Product catalog",
    description: "Your everyday essentials, organized for everyday trade.",
    action: "Add product",
    roles: ["COMPANY_ADMIN"],
  },
  beats: {
    title: "Routes & visits",
    description: "Make every visit count. Plan your beat and stay on track.",
    action: "Create beat",
    roles: ["COMPANY_ADMIN", "AREA_MANAGER"],
  },
  collections: {
    title: "Collections",
    description: "Every payment accounted for. Every balance in view.",
    action: "Record collection",
    roles: ["COMPANY_ADMIN", "AREA_MANAGER", "SR", "ACCOUNTS"],
  },
  schemes: {
    title: "Trade schemes",
    description: "Give your outlets a little more reason to order.",
    action: "Create scheme",
    roles: ["COMPANY_ADMIN"],
  },
  targets: {
    title: "Targets & incentives",
    description: "Clear goals. Visible progress. Rewards that add up.",
    action: "Set target",
    roles: ["COMPANY_ADMIN", "AREA_MANAGER"],
  },
  claims: {
    title: "Claims & returns",
    description: "Resolve delivery issues with a clear, accountable review.",
    action: "Submit claim",
    roles: ["COMPANY_ADMIN", "AREA_MANAGER", "SR", "DISTRIBUTOR"],
  },
  team: {
    title: "Team & territories",
    description: "The people and places behind your distribution network.",
    action: "Add partner",
    roles: ["COMPANY_ADMIN", "AREA_MANAGER"],
  },
  sync: {
    title: "Sync center",
    description: "Keep moving, even when your connection doesn’t.",
  },
  settings: {
    title: "Settings",
    description: "Your workspace, regional configuration and account.",
  },
};
function Content({ section }: { section: string }) {
  const { user } = useApp(),
    [create, setCreate] = useState(false),
    [order, setOrder] = useState(false);
  const m = meta[section],
    props = { create, onCreated: () => setCreate(false) };
  return (
    <Shell section={section}>
      {section === "overview" ? (
        <Overview newOrder={() => setOrder(true)} />
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">DISTRIBUTION WORKSPACE</span>
              <h1>{m?.title}</h1>
              <p>{m?.description}</p>
            </div>
            {m?.action && m.roles?.includes(user.role) && (
              <button
                className="button primary"
                onClick={() =>
                  section === "orders" ? setOrder(true) : setCreate(true)
                }
              >
                <Plus size={18} />
                {m.action}
              </button>
            )}
          </div>
          {section === "orders" && <Orders />}
          {section === "deliveries" && <Orders delivery />}
          {section === "outlets" && <Outlets {...props} />}
          {section === "inventory" && <Inventory {...props} />}
          {section === "catalog" && <Inventory catalog {...props} />}
          {section === "collections" && <Collections {...props} />}
          {section === "beats" && <Beats {...props} />}
          {section === "schemes" && <Schemes {...props} />}
          {section === "targets" && <Targets {...props} />}
          {section === "claims" && <Claims {...props} />}
          {section === "team" && <Team {...props} />}
          {section === "sync" && <SyncCenter />}
          {section === "settings" && <Settings />}
        </>
      )}
      {order && <OrderComposer onClose={() => setOrder(false)} />}
    </Shell>
  );
}
export function Workspace({ section }: { section: string }) {
  return (
    <AppProvider>
      <Content section={section} />
    </AppProvider>
  );
}
