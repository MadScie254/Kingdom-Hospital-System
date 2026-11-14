"use client";
import { Logo } from "./logo";
import { useDB } from "@/lib/store";

export function useHospital() {
  return useDB().settings[0];
}

export function DocHeader({ title, lines }: { title: string; lines?: { k: string; v: string }[] }) {
  const h = useHospital();
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5 border-b-2 border-brand pb-5">
      <div className="flex min-w-0 flex-wrap items-start gap-x-4 gap-y-3">
        <Logo height={58} />
        <div className="min-w-0 border-line leading-snug sm:border-l sm:pl-4">
          <div className="text-[16px] font-semibold text-ink">{h.name}</div>
          {h.registration && <div className="text-xs text-muted">{h.registration}</div>}
          <div className="mt-1 text-xs text-muted">{h.address}</div>
          <div className="text-xs text-muted [overflow-wrap:anywhere]">{[h.phone, h.email].filter(Boolean).join(", ")}</div>
          {h.kra && <div className="text-xs text-muted">KRA PIN {h.kra}</div>}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[26px] font-semibold leading-none text-brand">{title}</div>
        {lines && <dl className="mt-3 space-y-0.5 text-xs">{lines.map((l) => <div key={l.k} className="flex justify-end gap-3"><dt className="text-muted">{l.k}</dt><dd className="min-w-[88px] font-medium tabular-nums text-text">{l.v}</dd></div>)}</dl>}
      </div>
    </header>
  );
}

export function DocFooter({ children }: { children?: React.ReactNode }) {
  const h = useHospital();
  return <footer className="mt-10 border-t border-line pt-4 text-center text-xs text-muted">{children || h.footer}</footer>;
}
