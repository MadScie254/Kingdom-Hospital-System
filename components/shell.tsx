"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown, LogOut, Menu, RefreshCw, Search, Settings, X } from "lucide-react";
import clsx from "clsx";
import { NAV, bestMatch } from "@/lib/nav";
import { loadAll, signOut, useDB, useStatus, useUser } from "@/lib/store";
import { Avatar, ToastHost } from "./ui";
import { Logo } from "./logo";
import { ANCHOR, fmtDate, dayName } from "@/lib/format";

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = bestMatch(pathname);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="px-5 pb-2 pt-5"><Logo height={58} /></div>
      <div className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-6">
        {NAV.map((g) => (
          <div key={g.heading} className="mt-4 first:mt-1">
            <div className="px-3 pb-1.5 text-[11.5px] font-medium text-faint">{g.heading}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const hasKids = !!it.children;
                const childActive = it.children?.some((c) => c.href === active);
                const isOpen = open[it.href] ?? !!childActive;
                if (!hasKids) {
                  return (
                    <li key={it.href}>
                      <Link href={it.href} onClick={onNavigate} className="nav-link" data-active={active === it.href} aria-current={active === it.href ? "page" : undefined}>
                        <Icon size={17} strokeWidth={1.8} />{it.label}
                      </Link>
                    </li>
                  );
                }
                return (
                  <li key={it.href}>
                    <button className="nav-link w-full cursor-pointer" data-active={!!childActive && !isOpen} aria-expanded={isOpen} onClick={() => setOpen({ ...open, [it.href]: !isOpen })}>
                      <Icon size={17} strokeWidth={1.8} />
                      <span className="flex-1 text-left">{it.label}</span>
                      <ChevronDown size={14} className={clsx("transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen && (
                      <ul className="mb-1 mt-0.5 space-y-0.5">
                        {it.children!.map((c) => (
                          <li key={c.href}>
                            <Link href={c.href} onClick={onNavigate} className="nav-sub" data-active={active === c.href} aria-current={active === c.href ? "page" : undefined}>{c.label}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

function GlobalSearch() {
  const { patients } = useDB();
  const [q, setQ] = useState("");
  const router = useRouter();
  const hits = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n.length < 2 ? [] : patients.filter((p) => p.name.toLowerCase().includes(n) || p.mrn.toLowerCase().includes(n) || p.phone.replace(/\s/g, "").includes(n.replace(/\s/g, ""))).slice(0, 6);
  }, [q, patients]);
  return (
    <div className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input className="input h-9 bg-surface pl-9" placeholder="Search patients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a patient" />
      {hits.length > 0 && (
        <ul className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-line bg-white shadow-xl">
          {hits.map((p) => (
            <li key={p.id}>
              <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface" onClick={() => { setQ(""); router.push(`/patients/${p.id}`); }}>
                <Avatar name={p.name} size={28} />
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{p.name}</span><span className="block text-xs text-muted">{p.mrn} &nbsp;{p.phone}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const { medicines, labOrders } = useDB();
  const status = useStatus();
  const user = useUser();
  const router = useRouter();
  useEffect(() => { if (status === "unauth") router.replace("/login"); }, [status, router]);
  const alerts = medicines.filter((m) => m.quantity <= m.reorder).length + labOrders.filter((l) => l.flag === "Critical" && l.status !== "Released").length;
  if (status !== "ready") {
    return (
      <div className="grid min-h-screen place-items-center bg-surface p-6 text-center">
        <div>
          <Logo height={64} className="mx-auto" />
          {status === "error" ? (
            <>
              <p className="mt-6 text-[13px] text-muted">The hospital server could not be reached.</p>
              <button className="btn btn-primary mt-3" onClick={() => loadAll()}>Try again</button>
            </>
          ) : <p className="mt-6 text-[13px] text-muted">{status === "unauth" ? "Opening the sign in page" : "Loading hospital records"}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="app-shell min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line bg-white lg:block"><Sidebar /></aside>
      {mobile && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="drawer-scrim absolute inset-0 bg-ink/60" onClick={() => setMobile(false)} />
          <aside className="drawer-panel absolute inset-y-0 left-0 w-[280px] bg-white">
            <button className="btn btn-ghost btn-icon absolute right-2 top-3" onClick={() => setMobile(false)} aria-label="Close menu"><X size={16} /></button>
            <Sidebar onNavigate={() => setMobile(false)} />
          </aside>
        </div>
      )}
      <div className="app-main lg:ml-[264px]">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <button className="btn btn-ghost btn-icon lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={18} /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn btn-ghost btn-icon" onClick={() => loadAll()} aria-label="Refresh records"><RefreshCw size={15} /></button>
            <span className="hidden pr-3 text-xs text-muted md:block">{dayName(ANCHOR)}, {fmtDate(ANCHOR)}</span>
            <Link href="/pharmacy" className="btn btn-ghost btn-icon relative" aria-label={`${alerts} stock and lab alerts`}>
              <Bell size={17} />
              {alerts > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white">{alerts}</span>}
            </Link>
            <div className="relative">
              <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Account menu">
                <Avatar name={user?.name || "User"} size={30} />
                <span className="hidden text-left leading-tight sm:block"><span className="block text-[13px] font-medium">{user?.name}</span><span className="block text-[11.5px] text-muted">{user?.role === "admin" ? "Administrator" : "Staff"}</span></span>
                <ChevronDown size={14} className="text-faint" />
              </button>
              {menu && (
                <div className="absolute right-0 top-11 z-50 w-48 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
                  <Link href="/settings" className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] hover:bg-surface"><Settings size={15} />Settings</Link>
                  <button className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] hover:bg-surface" onClick={() => signOut()}><LogOut size={15} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <ToastHost />
    </div>
  );
}
