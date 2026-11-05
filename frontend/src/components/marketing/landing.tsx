"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Package,
  Store,
  Truck,
  Wallet,
  ShieldCheck,
  WifiOff,
  Route,
  Layers3,
  Menu,
  X,
  Radar,
  ClipboardCheck,
  MoveUpRight,
} from "lucide-react";

const views = [
  {
    name: "Control tower",
    image: "/images/control-tower.png",
    title: "See the whole picture. Act on what matters.",
    text: "Stock, supply, field execution and settlement meet in one operating view. Spot expiry risks, pending approvals and customer refunds before they get lost in the day.",
    points: [
      "Prioritized operational exceptions",
      "Receivables and payables in one view",
      "A traceable record of business activity",
    ],
  },
  {
    name: "Procurement",
    image: "/images/procurement.png",
    title: "From purchase order to paid supplier.",
    text: "Keep purchasing connected to the warehouse and the finance desk. Approve orders, receive partial shipments and track batch costs without losing the original paper trail.",
    points: [
      "Purchase approvals and partial receipts",
      "Batch, expiry and landed cost tracking",
      "Supplier balances and payment records",
    ],
  },
];
const capabilities = [
  {
    icon: Package,
    title: "Every batch accounted for",
    text: "FEFO allocation, expiry alerts, quarantine, transfers and cycle counts. Know where your stock is—and what should move next.",
    tag: "WAREHOUSE & INVENTORY",
  },
  {
    icon: Route,
    title: "A field team in sync",
    text: "Outlet visits, GPS check-ins, trade schemes and assigned checklists. Keep orders and collections moving with an offline queue.",
    tag: "SALES & FIELD EXECUTION",
  },
  {
    icon: Wallet,
    title: "Close the loop on cash",
    text: "Invoice aging, supplier payments, cash handovers and return credits. Follow the money through balanced journal entries.",
    tag: "FINANCE & SETTLEMENT",
  },
];

export function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [view, setView] = useState(0);
  const active = views[view];
  return (
    <div className="landing-page">
      <a className="lp-skip" href="#landing-main">
        Skip to content
      </a>
      <header className="lp-header">
        <div className="lp-container lp-nav">
          <Link href="/" className="lp-logo" aria-label="DeshFlow home">
            <span>d</span>deshflow<span className="lp-logo-dot">.</span>
          </Link>
          <nav
            aria-label="Main navigation"
            className={menuOpen ? "lp-links is-open" : "lp-links"}
            id="landing-navigation"
          >
            <a href="#platform" onClick={() => setMenuOpen(false)}>
              Platform
            </a>
            <a href="#workflow" onClick={() => setMenuOpen(false)}>
              How it works
            </a>
            <a href="#built-for-you" onClick={() => setMenuOpen(false)}>
              Built for your team
            </a>
            <Link href="/login" className="lp-mobile-signin">
              Sign in <ArrowUpRight size={16} />
            </Link>
          </nav>
          <Link className="lp-nav-signin" href="/login">
            Sign in <ArrowUpRight size={16} />
          </Link>
          <button
            className="lp-menu"
            aria-expanded={menuOpen}
            aria-controls="landing-navigation"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen(!menuOpen)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMenuOpen(false);
            }}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      <main id="landing-main">
        <section className="lp-hero lp-container" aria-labelledby="hero-title">
          <div className="lp-hero-copy">
            <div className="lp-eyebrow">
              <span className="lp-status-dot" /> THE CONNECTED DISTRIBUTION
              WORKSPACE
            </div>
            <h1 id="hero-title">
              Less friction.
              <br />
              More{" "}
              <span>
                flow.
                <svg viewBox="0 0 300 20" aria-hidden="true">
                  <path d="M5 13Q140 -5 293 9M40 18Q170 5 273 16" />
                </svg>
              </span>
            </h1>
            <p>
              From the first order to the last mile.
              <br className="lp-desktop-break" /> Bring your stockroom, field
              team and finance desk into one clear picture.
            </p>
            <div className="lp-hero-actions">
              <Link href="/control" className="lp-button lp-button-dark">
                Open your workspace <ArrowUpRight size={19} />
              </Link>
              <a href="#platform" className="lp-text-link">
                Take a closer look <ArrowRight size={18} />
              </a>
            </div>
            <div className="lp-hero-note">
              <ShieldCheck size={17} /> Role-based access <span />{" "}
              <WifiOff size={17} /> Offline field orders
            </div>
          </div>

          <div
            className="lp-network"
            aria-label="Illustration of a connected distribution network"
          >
            <div className="lp-network-top">
              <span>
                <span className="lp-status-dot" /> YOUR NETWORK, CONNECTED
              </span>
              <MoveUpRight size={18} />
            </div>
            <svg
              className="lp-network-lines"
              viewBox="0 0 560 460"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id="map-grid"
                  width="28"
                  height="28"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r="1" fill="#b4c1aa" />
                </pattern>
              </defs>
              <rect width="560" height="460" fill="url(#map-grid)" />
              <circle cx="280" cy="230" r="94" stroke="#b4c0a2" />
              <circle
                cx="280"
                cy="230"
                r="158"
                stroke="#c8d0b9"
                strokeDasharray="5 8"
              />
              <path
                d="M95 120L280 230L450 106M100 350L280 230L450 350"
                stroke="#758c64"
                strokeWidth="1.5"
                strokeDasharray="5 6"
              />
              <path
                d="M0 260C140 190 120 410 335 330S440 155 560 220"
                stroke="#fff"
                strokeWidth="22"
              />
              <path
                d="M0 260C140 190 120 410 335 330S440 155 560 220"
                stroke="#c4ccb5"
                strokeWidth="1"
              />
            </svg>
            <div className="lp-hub">
              <span className="lp-hub-mark">d</span>
              <strong>One workspace.</strong>
              <span>Every moving part.</span>
            </div>
            <div className="lp-node lp-node-stock">
              <span className="lp-node-icon">
                <Package size={22} />
              </span>
              <div>
                <strong>Stockroom</strong>
                <span>Ready for the next order</span>
              </div>
              <span className="lp-node-check">
                <Check size={14} />
              </span>
            </div>
            <div className="lp-node lp-node-field">
              <span className="lp-node-icon">
                <Store size={22} />
              </span>
              <div>
                <strong>Field sales</strong>
                <span>Closer to every outlet</span>
              </div>
            </div>
            <div className="lp-node lp-node-truck">
              <span className="lp-node-icon">
                <Truck size={22} />
              </span>
              <div>
                <strong>Last-mile delivery</strong>
                <span>From dispatch to doorstep</span>
              </div>
            </div>
            <div className="lp-node lp-node-cash">
              <span className="lp-node-icon">
                <Wallet size={22} />
              </span>
              <div>
                <strong>Finance desk</strong>
                <span>Every balance connected</span>
              </div>
              <span className="lp-node-check">
                <Check size={14} />
              </span>
            </div>
            <div className="lp-network-bottom">
              <span>SUPPLY → SELL → DELIVER → SETTLE</span>
              <span>Distribution, in flow.</span>
            </div>
          </div>
        </section>

        <div className="lp-principles">
          <div className="lp-container">
            <p>
              Made for the way
              <br />
              <strong>distribution really works.</strong>
            </p>
            <span>
              <Layers3 /> Batch-level visibility
            </span>
            <span>
              <ClipboardCheck /> Connected field execution
            </span>
            <span>
              <ShieldCheck /> Traceable approvals
            </span>
          </div>
        </div>

        <section
          className="lp-platform lp-container lp-section"
          id="platform"
          aria-labelledby="platform-title"
        >
          <div className="lp-section-heading">
            <div>
              <span className="lp-eyebrow">
                A LITTLE CLARITY GOES A LONG WAY
              </span>
              <h2 id="platform-title">
                Many moving parts.
                <br />
                <span>One place to run them.</span>
              </h2>
            </div>
            <p>
              A distribution business doesn’t happen in silos. Your software
              shouldn’t either.
            </p>
          </div>
          <div className="lp-product">
            <div className="lp-product-copy">
              <div
                className="lp-tabs"
                role="tablist"
                aria-label="Explore workspace features"
              >
                {views.map((item, index) => (
                  <button
                    key={item.name}
                    role="tab"
                    id={`preview-tab-${index}`}
                    aria-selected={view === index}
                    aria-controls="workspace-preview"
                    tabIndex={view === index ? 0 : -1}
                    onClick={() => setView(index)}
                    onKeyDown={(event) => {
                      if (
                        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          event.key,
                        )
                      ) {
                        event.preventDefault();
                        const next =
                          event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? views.length - 1
                              : (view +
                                  (event.key === "ArrowRight"
                                    ? 1
                                    : views.length - 1)) %
                                views.length;
                        setView(next);
                        document.getElementById(`preview-tab-${next}`)?.focus();
                      }
                    }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <div
                id="workspace-preview"
                role="tabpanel"
                aria-labelledby={`preview-tab-${view}`}
                tabIndex={0}
              >
                <div className="lp-feature-symbol">
                  {view === 0 ? <Radar size={28} /> : <Package size={28} />}
                </div>
                <h3>{active.title}</h3>
                <p>{active.text}</p>
                <ul>
                  {active.points.map((point) => (
                    <li key={point}>
                      <Check size={17} />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link
                  href={view === 0 ? "/control" : "/procurement"}
                  className="lp-text-link"
                >
                  Explore the workspace <ArrowRight size={18} />
                </Link>
              </div>
            </div>
            <div className="lp-product-screen">
              <div className="lp-window-bar">
                <span />
                <span />
                <span />
                <p>deshflow / {active.name.toLowerCase()}</p>
                <ShieldCheck size={15} />
              </div>
              <div className="lp-screenshot">
                <Image
                  key={active.image}
                  src={active.image}
                  alt={`${active.name} workspace with sample business records`}
                  width={1280}
                  height={1910}
                  sizes="(max-width: 800px) 100vw, 65vw"
                />
              </div>
              <span className="lp-preview-label">
                Actual product preview · Sample workspace data
              </span>
            </div>
          </div>
          <div className="lp-capabilities">
            {capabilities.map(({ icon: Icon, title, text, tag }, index) => (
              <article key={title}>
                <div className="lp-capability-top">
                  <Icon size={26} />
                  <span>0{index + 1}</span>
                </div>
                <span className="lp-eyebrow">{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="lp-workflow"
          id="workflow"
          aria-labelledby="workflow-title"
        >
          <div className="lp-container lp-section">
            <div className="lp-section-heading">
              <div>
                <span className="lp-eyebrow">FROM START TO SETTLED</span>
                <h2 id="workflow-title">A good day has a flow.</h2>
              </div>
              <p>
                Every handover carries the context forward. Less chasing. More
                doing.
              </p>
            </div>
            <div className="lp-steps">
              {[
                {
                  icon: Package,
                  name: "Stock with confidence",
                  text: "Raise a purchase order. Receive by batch. Keep usable stock ready to allocate.",
                },
                {
                  icon: Store,
                  name: "Make every visit count",
                  text: "Plan beats, capture outlet orders and apply the right price and trade scheme.",
                },
                {
                  icon: Truck,
                  name: "Deliver on the promise",
                  text: "Allocate stock, plan vehicle trips and record delivery outcomes and proof references.",
                },
                {
                  icon: Wallet,
                  name: "Bring it back to balance",
                  text: "Record collections, reconcile handovers and settle returns with a clear credit trail.",
                },
              ].map(({ icon: Icon, name, text }, index) => (
                <article key={name}>
                  <div className="lp-step-number">
                    <Icon size={23} />
                    <span>0{index + 1}</span>
                  </div>
                  <h3>{name}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="lp-team lp-container lp-section"
          id="built-for-you"
          aria-labelledby="team-title"
        >
          <div className="lp-team-heading">
            <span className="lp-eyebrow">SAME BUSINESS. SHARED CONTEXT.</span>
            <h2 id="team-title">
              From the warehouse
              <br />
              floor to the field.
            </h2>
            <p>
              Give each team the tools they need, with a shared view of the work
              that connects them.
            </p>
            <Link href="/control" className="lp-text-link">
              Meet your new workspace <ArrowRight size={18} />
            </Link>
          </div>
          <div className="lp-team-grid">
            {[
              {
                icon: Radar,
                title: "For business owners",
                text: "Follow working capital, performance and the exceptions that need your decision.",
              },
              {
                icon: Package,
                title: "For operations teams",
                text: "Coordinate purchasing, stock transfers, dispatch and return disposition.",
              },
              {
                icon: Route,
                title: "For field teams",
                text: "Keep visits, orders, collections and outlet follow-ups in one working day.",
              },
              {
                icon: Wallet,
                title: "For finance teams",
                text: "Connect customer and supplier balances to payments, credits and journal entries.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <Icon size={24} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-faq lp-container" aria-labelledby="faq-title">
          <div>
            <span className="lp-eyebrow">A FEW USEFUL DETAILS</span>
            <h2 id="faq-title">Before you jump in.</h2>
          </div>
          <div>
            {[
              {
                q: "Can the field team work without internet?",
                a: "Orders and collections can be queued on the signed-in device and synced when the connection returns. Procurement, warehouse and finance operations need an internet connection. Sign in and load the workspace before going offline.",
              },
              {
                q: "Does everyone get the same access?",
                a: "No. Access follows the team member’s role and assigned scope. Approval workflows help keep sensitive decisions, such as credit exceptions and stock variances, with the right people.",
              },
              {
                q: "How are payments and delivery proof handled?",
                a: "Record cash, bKash, Nagad and cheque collections in the workspace. These are payment records, not live payment gateway integrations. Delivery proof stores recipient details, GPS and evidence references; media uploads are not included.",
              },
            ].map(({ q, a }) => (
              <details key={q}>
                <summary>
                  {q}
                  <ChevronDown size={20} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-cta lp-container">
          <div className="lp-cta-pattern" aria-hidden="true" />
          <span className="lp-eyebrow">YOUR NEXT WORKING DAY, CONNECTED</span>
          <h2>
            Keep business moving.
            <br />
            <span>Keep it in flow.</span>
          </h2>
          <p>One workspace for the people who make distribution happen.</p>
          <Link href="/control" className="lp-button lp-button-lime">
            Let’s get to work <ArrowUpRight size={20} />
          </Link>
          <span className="lp-cta-note">
            Sign in with your team account to continue.
          </span>
        </section>
      </main>
      <footer className="lp-footer lp-container">
        <div>
          <Link href="/" className="lp-logo" aria-label="DeshFlow home">
            <span>d</span>deshflow<span className="lp-logo-dot">.</span>
          </Link>
          <p>Distribution, in flow.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#platform">Platform</a>
          <a href="#workflow">How it works</a>
          <Link href="/login">
            Sign in <ArrowUpRight size={15} />
          </Link>
        </nav>
        <span>© {new Date().getFullYear()} DeshFlow</span>
      </footer>
    </div>
  );
}
