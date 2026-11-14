"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Download, Printer, Search, X, Inbox } from "lucide-react";
import clsx from "clsx";
import { download, initials, toCSV } from "@/lib/format";

export { clsx };

/* ---------- status ---------- */
const TONES: Record<string, string[]> = {
  ok: ["paid", "completed", "released", "active", "confirmed", "available", "treated", "approved", "normal", "present", "resolved", "discharged", "reported", "in stock", "reactive negative"],
  warn: ["partial", "pending", "processing", "review", "in progress", "in consultation", "follow up required", "requested", "scheduled", "on call", "cleaning", "reserved", "high", "low", "medium", "draft", "late", "awaiting report", "low stock", "on leave", "submitted", "expiring"],
  bad: ["due", "critical", "rejected", "cancelled", "maintenance", "abnormal", "stock out", "expired", "overdue", "inactive", "absent"],
  info: ["ordered", "collected", "occupied", "admitted", "on trip", "urgent"],
};
export function toneOf(v: string): string {
  const k = String(v || "").toLowerCase();
  for (const t of Object.keys(TONES)) if (TONES[t].includes(k)) return t;
  return "mute";
}
export function Badge({ tone = "mute", children, plain }: { tone?: string; children: React.ReactNode; plain?: boolean }) {
  return <span className={clsx("badge", plain && "badge-plain", `b-${tone}`)}>{children}</span>;
}
export const Status = ({ value }: { value: string }) => <Badge tone={toneOf(value)}>{value || "Not set"}</Badge>;

/* ---------- layout bits ---------- */
export function PageHeader({ title, description, crumbs, actions }: { title: string; description?: string; crumbs?: { label: string; href?: string }[]; actions?: React.ReactNode }) {
  useEffect(() => { document.title = `${title} | Kingdom Hospital`; }, [title]);
  return (
    <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 text-xs text-muted">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {c.href ? <Link href={c.href} className="hover:text-brand hover:underline">{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <ChevronRight size={12} className="text-faint" />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[22px] font-semibold leading-tight text-text">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONE_BG: Record<string, string> = { brand: "bg-brand-50 text-brand", ok: "bg-ok-50 text-ok", warn: "bg-warn-50 text-warn", bad: "bg-bad-50 text-bad", steel: "bg-steel-50 text-steel", gold: "bg-gold-50 text-gold", mute: "bg-surface text-muted" };
export function Stat({ label, value, hint, tone = "brand", icon: Icon, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: string; icon?: React.ComponentType<{ size?: number }>; href?: string }) {
  const body = (
    <div className={clsx("card flex items-start justify-between gap-3 p-4", href && "transition-colors hover:border-[#bfcdc7]")}>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted">{label}</div>
        <div className="mt-1.5 text-[20px] font-semibold leading-tight tabular-nums text-text sm:text-[24px]">{value}</div>
        {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
      </div>
      {Icon && <span className={clsx("hidden h-9 w-9 shrink-0 place-items-center rounded-lg sm:grid", TONE_BG[tone])}><Icon size={18} /></span>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Avatar({ name, size = 32, tone = "brand" }: { name: string; size?: number; tone?: string }) {
  return (
    <span className={clsx("inline-grid shrink-0 place-items-center rounded-full font-semibold", TONE_BG[tone])} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { value: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div role="tablist" className="no-print flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={clsx("-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors", value === t.value ? "border-brand text-brand" : "border-transparent text-muted hover:text-text")}>
          {t.label}
          {t.count !== undefined && <span className={clsx("rounded-full px-1.5 text-[11px] tabular-nums", value === t.value ? "bg-brand-50 text-brand" : "bg-surface text-muted")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center px-6 py-14 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface text-faint"><Inbox size={20} /></span>
      <div className="text-sm font-semibold text-text">{title}</div>
      {hint && <p className="mt-1 max-w-sm text-[13px] text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- toasts ---------- */
let toasts: { id: number; msg: string }[] = [];
const NO_TOASTS: { id: number; msg: string }[] = [];
const tl = new Set<() => void>();
export function toast(msg: string) {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, msg }];
  tl.forEach((l) => l());
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); tl.forEach((l) => l()); }, 3200);
}
export function ToastHost() {
  const list = useSyncExternalStore((l) => { tl.add(l); return () => { tl.delete(l); }; }, () => toasts, () => NO_TOASTS);
  return (
    <div className="no-print pointer-events-none fixed bottom-5 right-5 z-[80] flex flex-col gap-2" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className="rounded-lg bg-ink px-4 py-2.5 text-[13px] text-white shadow-lg">{t.msg}</div>)}
    </div>
  );
}

/* ---------- overlays ---------- */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560 }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[70]">
      <div className="drawer-scrim absolute inset-0 bg-ink/45" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={title} className="drawer-panel absolute right-0 top-0 flex h-full w-full flex-col bg-white shadow-2xl" style={{ maxWidth: width }}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-line bg-[#f9fbfa] px-6 py-3.5">{footer}</footer>}
      </aside>
    </div>
  );
}

export function Dialog({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[75] grid place-items-center p-4">
      <div className="drawer-scrim absolute inset-0 bg-ink/45" onClick={onClose} />
      <div role="alertdialog" aria-modal="true" aria-label={title} className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="mt-2 text-[13px] text-muted">{children}</div>
        <div className="mt-6 flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

/* ---------- forms ---------- */
export function Field({ label, required, hint, children, span = 1 }: { label: string; required?: boolean; hint?: string; children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <label className={clsx("block", span === 2 && "sm:col-span-2")}>
      <span className="label">{label}{required && <span className="text-bad"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}
export const FormGrid = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">{children}</div>;

/* ---------- data table ---------- */
export type Col<T = any> = { key: string; header: string; render?: (row: T) => React.ReactNode; value?: (row: T) => string | number; align?: "right"; nosort?: boolean; width?: number };

export function DataTable<T extends { id: number }>({ rows, cols, searchPlaceholder = "Search", pageSize = 12, filters, exportName, onRowClick, toolbarExtra, empty, dense }: {
  rows: T[]; cols: Col<T>[]; searchPlaceholder?: string; pageSize?: number; exportName?: string; onRowClick?: (r: T) => void; toolbarExtra?: React.ReactNode; dense?: boolean;
  filters?: { key: string; label: string; options: string[]; get: (r: T) => string }[]; empty?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [fv, setFv] = useState<Record<string, string>>({});
  const val = (c: Col<T>, r: T) => (c.value ? c.value(r) : (r as any)[c.key]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => (filters || []).every((f) => !fv[f.key] || f.get(r) === fv[f.key]));
    if (needle) out = out.filter((r) => cols.some((c) => String(val(c, r) ?? "").toLowerCase().includes(needle)));
    if (sort) {
      const c = cols.find((x) => x.key === sort.key);
      if (c) out = [...out].sort((a, b) => { const x = val(c, a), y = val(c, b); return (typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true })) * sort.dir; });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, fv]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const view = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  const exportCSV = () => {
    const data = filtered.map((r) => Object.fromEntries(cols.filter((c) => c.key !== "actions").map((c) => [c.header, val(c, r)])));
    download(`${exportName || "export"}.csv`, toCSV(data, cols.filter((c) => c.key !== "actions").map((c) => c.header)));
  };

  return (
    <div>
      <div className="no-print flex flex-wrap items-center gap-2.5 border-b border-line-2 px-4 py-3">
        <div className="relative w-full max-w-[280px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input pl-9" placeholder={searchPlaceholder} value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search table" />
        </div>
        {(filters || []).map((f) => (
          <select key={f.key} className="input w-auto min-w-[140px]" aria-label={f.label} value={fv[f.key] || ""} onChange={(e) => { setFv({ ...fv, [f.key]: e.target.value }); setPage(0); }}>
            <option value="">{f.label}: all</option>
            {f.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {toolbarExtra}
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}><Download size={14} />Export CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={14} />Print</button>
        </div>
      </div>
      <div className="scroll-thin overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={clsx(c.align === "right" && "text-right")} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                  {c.nosort || c.key === "actions" ? c.header : (
                    <button className="inline-flex items-center gap-1 font-semibold hover:text-text" onClick={() => setSort(sort?.key === c.key ? (sort.dir === 1 ? { key: c.key, dir: -1 } : null) : { key: c.key, dir: 1 })}>
                      {c.header}
                      {sort?.key === c.key ? (sort.dir === 1 ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : <ChevronDown size={13} className="opacity-0" />}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} className={clsx(onRowClick && "cursor-pointer")}>
                {cols.map((c) => { const v = c.render ? c.render(r) : String(val(c, r) ?? ""); return <td key={c.key} className={clsx(c.align === "right" && "num", dense && "!py-2", typeof v === "string" && v.length < 26 && "whitespace-nowrap")}>{v}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
        {view.length === 0 && (empty || <Empty title="No records found" hint={q || Object.values(fv).some(Boolean) ? "Clear the search or filters to see more records." : "Records you add will appear here."} />)}
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line-2 px-4 py-3 text-xs text-muted">
        <span>{filtered.length === 0 ? "No entries" : `Showing ${cur * pageSize + 1} to ${Math.min(filtered.length, cur * pageSize + pageSize)} of ${filtered.length} entries`}</span>
        <div className="flex items-center gap-1">
          <button className="btn btn-secondary btn-sm btn-icon" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
          <span className="px-2 tabular-nums">Page {cur + 1} of {pages}</span>
          <button className="btn btn-secondary btn-sm btn-icon" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const [state, set] = useState<{ title: string; body: string; run: () => void } | null>(null);
  const node = (
    <Dialog open={!!state} onClose={() => set(null)} title={state?.title || ""}
      footer={<><button className="btn btn-secondary" onClick={() => set(null)}>Keep it</button><button className="btn btn-primary !bg-bad !border-bad" onClick={() => { state?.run(); set(null); }}>Delete</button></>}>
      {state?.body}
    </Dialog>
  );
  return { ask: (title: string, body: string, run: () => void) => set({ title, body, run }), node };
}

export function useFocusFirst(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea")?.focus(), 60); }, [open]);
  return ref;
}
