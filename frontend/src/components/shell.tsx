"use client";
import Link from "next/link";
import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Truck,
  Store,
  Package,
  Map,
  Wallet,
  TicketPercent,
  Target,
  RotateCcw,
  Users,
  RefreshCw,
  Settings,
  ChevronDown,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  Search,
  Check,
  Command,
} from "lucide-react";
import { useApp } from "./provider";
import { initials, label } from "@/lib/format";
import type { LucideIcon } from "lucide-react";
const nav: {group: string; items: [string, string, LucideIcon][]}[] = [
  {
    group: "WORKSPACE",
    items: [
      ["overview", "Overview", LayoutDashboard],
      ["orders", "Orders", ShoppingBag],
      ["deliveries", "Deliveries", Truck],
      ["outlets", "Outlets", Store],
      ["inventory", "Inventory", Package],
      ["catalog", "Product catalog", ShoppingBag],
    ],
  },
  {
    group: "FIELD & FINANCE",
    items: [
      ["beats", "Routes & visits", Map],
      ["collections", "Collections", Wallet],
      ["schemes", "Trade schemes", TicketPercent],
      ["targets", "Targets & incentives", Target],
      ["claims", "Claims & returns", RotateCcw],
      ["team", "Team & territories", Users],
    ],
  },
];
export function Shell({
  section,
  children,
}: {
  section: string;
  children: React.ReactNode;
}) {
  const { user, data, queue, online, logout } = useApp(),
    [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(false);
  const title =
    nav.flatMap((g) => g.items).find((n) => n[0] === section)?.[1] ||
    label(section);
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {open && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-symbol">d</span>deshflow
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace-switch">
          <span className="workspace-avatar">RT</span>
          <div>
            <strong>Rahman Trading Co.</strong>
            <span>Distribution workspace</span>
          </div>
          <ChevronDown size={16} />
        </div>
        <nav aria-label="Main navigation">
          {nav.map((group) => (
            <div className="nav-group" key={group.group}>
              <p>{group.group}</p>
              {group.items.map(([id, text, Icon]) => (
                <Link
                  key={id}
                  href={id === "overview" ? "/" : `/${id}`}
                  onClick={() => setOpen(false)}
                  aria-current={section === id ? "page" : undefined}
                  className={`nav-item ${section === id ? "active" : ""}`}
                >
                  <Icon size={19} />
                  <span>{text}</span>
                  {id === "orders" && (
                    <span className="nav-count">
                      {
                        data.orders.filter((o) => o.status === "SUBMITTED")
                          .length
                      }
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link
            href="/sync"
            className={`nav-item ${section === "sync" ? "active" : ""}`}
          >
            <RefreshCw size={18} />
            <span>Sync center</span>
            {queue.length > 0 && (
              <span className="nav-count">{queue.length}</span>
            )}
          </Link>
          <Link
            href="/settings"
            className={`nav-item ${section === "settings" ? "active" : ""}`}
          >
            <Settings size={18} />
            Settings
          </Link>
          <div className="sidebar-tip">
            <span className="status-dot" />
            <strong>
              {online ? "All systems connected" : "Working offline"}
            </strong>
            <p>
              {online
                ? "Your team’s work, in sync."
                : "Orders stay safe on this device."}
            </p>
          </div>
          <div className="user-profile">
            <span className="avatar">{initials(user.fullName)}</span>
            <div>
              <strong>{user.fullName}</strong>
              <span>{label(user.role)}</span>
            </div>
            <button
              onClick={() => void logout()}
              title="Sign out"
              aria-label="Sign out"
              className="icon-button"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="global-search"
              onClick={() => setSearch(!search)}
            >
              <Search size={17} />
              <span>Search workspace</span>
              <kbd>
                <Command size={12} /> K
              </kbd>
            </button>
            <span className={`connection ${online ? "" : "offline"}`}>
              <span className="status-dot" />
              {online ? "Live workspace" : "Offline"}
            </span>
            <span className="top-avatar">{initials(user.fullName)}</span>
          </div>
        </header>
        {search && (
          <div className="global-search-results">
            <div className="search">
              <Search size={18} />
              <input
                autoFocus
                placeholder="Find an outlet, order or product…"
                aria-label="Search workspace"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="icon-button"
                aria-label="Close search"
                onClick={() => setSearch(false)}
              >
                <X size={18} />
              </button>
            </div>
            {query && (
              <div className="search-links">
                {data.outlets
                  .filter((o) =>
                    o.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .slice(0, 4)
                  .map((o) => (
                    <Link
                      href="/outlets"
                      key={o.id}
                      onClick={() => setSearch(false)}
                    >
                      <Store size={17} />
                      {o.name}
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                {data.orders
                  .filter((o) =>
                    o.number.toLowerCase().includes(query.toLowerCase()),
                  )
                  .slice(0, 3)
                  .map((o) => (
                    <Link
                      href="/orders"
                      key={o.id}
                      onClick={() => setSearch(false)}
                    >
                      <ShoppingBag size={17} />
                      {o.number}
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                {data.skus
                  .filter((s) =>
                    s.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .slice(0, 3)
                  .map((s) => (
                    <Link
                      href="/catalog"
                      key={s.id}
                      onClick={() => setSearch(false)}
                    >
                      <Package size={17} />
                      {s.name}
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
              </div>
            )}
          </div>
        )}
        <main id="main" className="content">
          {!online && (
            <div className="offline-banner">
              <Check size={18} />
              You’re offline. Saved records are available and new orders will
              queue for sync.
            </div>
          )}
          {children}
        </main>
        <footer className="app-footer">
          <span>DeshFlow · Distribution, in flow.</span>
          <span>All times in Bangladesh Standard Time</span>
        </footer>
      </div>
    </div>
  );
}
