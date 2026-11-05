"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, Search, Inbox, LoaderCircle } from "lucide-react";
import { label } from "@/lib/format";
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>{label(value)}</span>
  );
}
export function Empty({
  title = "Nothing here yet",
  detail = "Your records will appear here as your team gets to work.",
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={36} />
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search records…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search">
      <Search size={18} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          className="icon-button"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Field({
  label: caption,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{caption}</span>
      {children}
    </label>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,[tabindex="0"]',
          ) || [],
        ).filter((i) => !i.hasAttribute("disabled"));
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={ref}
      >
        <div className="modal-heading">
          <h2 id={id}>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Submit({
  busy,
  label: caption = "Save changes",
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <button type="submit" className="button primary" disabled={busy}>
      {busy && <LoaderCircle size={17} className="spin" />}
      {busy ? "Saving…" : caption}
    </button>
  );
}
export function SimpleForm({
  onSubmit,
  children,
  submit = "Save changes",
}: {
  onSubmit: (data: FormData) => Promise<void>;
  children: ReactNode;
  submit?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        try {
          await onSubmit(new FormData(e.currentTarget));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Unable to save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">{children}</div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <Submit busy={busy} label={submit} />
      </div>
    </form>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label="Achievement"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
