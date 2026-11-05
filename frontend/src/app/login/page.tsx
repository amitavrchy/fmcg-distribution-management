"use client";
import { useState } from "react";
import { ArrowRight, Boxes, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";
import { Field, Submit } from "@/components/ui";
export default function Login() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <a href="/" className="brand">
          <span className="brand-symbol">d</span>deshflow
          <span className="brand-dot">.</span>
        </a>
        <div>
          <span className="eyebrow">BUILT FOR THE WAY YOU DISTRIBUTE</span>
          <h1>
            Every outlet.
            <br />
            Every order.
            <br />
            <em>Moving forward.</em>
          </h1>
          <p>
            Bring your field team, stock and sales together in one clear
            workspace.
          </p>
          <div className="login-proof">
            <Boxes size={22} />
            Made for Bangladesh’s everyday trade.
          </div>
        </div>
        <span className="login-foot">
          A clearer view. A stronger distribution network.
        </span>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <div className="login-icon">
            <ShieldCheck size={28} />
          </div>
          <h2>Welcome back</h2>
          <p>Sign in to your distribution workspace.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                await api("auth/login", {
                  email: f.get("email"),
                  password: f.get("password"),
                });
                location.href = "/control";
              } catch (e) {
                setError(e instanceof Error ? e.message : "Unable to sign in");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email address">
              <input
                type="email"
                autoComplete="username"
                name="email"
                placeholder="you@company.com"
                required
              />
            </Field>
            <Field label="Password">
              <div className="password-input">
                <input
                  type={show ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                  className="icon-button"
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <Submit busy={busy} label="Sign in to workspace" />
          </form>
          <div className="login-note">
            <ArrowRight size={18} />
            <p>
              Need access? Ask your company administrator for your account
              details.
            </p>
          </div>
        </div>
        <p className="muted">DeshFlow · Distribution, in flow.</p>
      </section>
    </main>
  );
}
