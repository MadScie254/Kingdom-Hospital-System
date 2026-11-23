"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, Bell, CalendarDays, ChevronDown, FlaskConical, Globe, LayoutDashboard, LogOut, Menu, Pill, Receipt, RefreshCw, Search, Settings, ShieldOff, Users, X } from "lucide-react";
import clsx from "clsx";
import { bestMatch, visibleNav, type NavGroup } from "@/lib/nav";
import { canOpen, canRead, ROLE_LABEL, type Role } from "@/lib/access";
import { ForcePassword } from "./force-password";
import { loadAll, signOut, useDB, usePending, useStatus, useUser } from "@/lib/store";
import { Avatar, ToastHost } from "./ui";
import { Logo } from "./logo";
import { ANCHOR, fmtDate, dayName } from "@/lib/format";
import { PORTAL_HOME } from "@/lib/site";

function Sidebar({ onNavigate, groups, pending }: { onNavigate?: () => void; groups: NavGroup[]; pending: number }) {
  const pathname = usePathname();
  const active = bestMatch(pathname);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="px-5 pb-2 pt-5">
        <Link href={PORTAL_HOME} onClick={onNavigate} aria-label="Go to the dashboard" className="inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"><Logo height={58} /></Link>
      </div>
      <div className="sidebar-scroll flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
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
                        {it.href === "/staff" && pending > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1.5 text-[11px] font-semibold text-white">{pending}</span>}
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
      <div className="border-t border-line-2 px-3 py-3">
        <a href="/" className="nav-link"><Globe size={17} strokeWidth={1.8} />Back to website</a>
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

const QUICK = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard }, { label: "Patients", href: "/patients", icon: Users },
  { label: "Schedule", href: "/appointments", icon: CalendarDays }, { label: "Lab", href: "/lab", icon: FlaskConical },
  { label: "Pharmacy", href: "/pharmacy", icon: Pill }, { label: "Billing", href: "/billing", icon: Receipt }, { label: "Wards", href: "/admissions", icon: BedDouble },
];

function BottomNav({ role, onMore }: { role: Role | undefined; onMore: () => void }) {
  const pathname = usePathname();
  const items = QUICK.filter((i) => canOpen(role, i.href)).slice(0, 4);
  const tab = "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium";
  return (
    <nav aria-label="Quick links" className="no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
      {items.map((i) => {
        const on = pathname === i.href || pathname.startsWith(i.href + "/");
        return <Link key={i.href} href={i.href} className={clsx(tab, on ? "text-brand" : "text-muted")} aria-current={on ? "page" : undefined}><i.icon size={20} strokeWidth={on ? 2.2 : 1.8} />{i.label}</Link>;
      })}
      <button className={clsx(tab, "text-muted")} onClick={onMore}><Menu size={20} strokeWidth={1.8} />More</button>
    </nav>
  );
}

function NoAccess({ role }: { role: Role | undefined }) {
  return (
    <div className="card mx-auto mt-10 max-w-md p-8 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-surface text-muted"><ShieldOff size={20} /></span>
      <h1 className="mt-4 text-lg font-semibold">This screen is not part of your access</h1>
      <p className="mt-1.5 text-[13px] text-muted">Your role is {role ? ROLE_LABEL[role] : "not set"}. If you need this screen, ask the hospital administrator.</p>
      <Link href="/dashboard" className="btn btn-primary mt-5">Go to home</Link>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [menu, setMenu] = useState(false);
  const { medicines, labOrders } = useDB();
  const status = useStatus();
  const user = useUser();
  const pending = usePending();
  const router = useRouter();
  const pathname = usePathname();
  const role = user?.role;
  useEffect(() => { if (status === "unauth") router.replace("/login"); }, [status, router]);
  const groups = useMemo(() => visibleNav(role), [role]);
  const lowStock = role === "admin" || role === "pharmacy" ? medicines.filter((m) => m.quantity <= m.reorder).length : 0;
  const critical = role && ["admin", "doctor", "nurse", "lab"].includes(role) ? labOrders.filter((l) => l.flag === "Critical" && l.status !== "Released").length : 0;
  const alerts = lowStock + critical + (role === "admin" ? pending : 0);
  const bellHref = role === "admin" && pending ? "/staff" : role === "lab" ? "/lab" : role === "pharmacy" ? "/pharmacy" : "/dashboard";
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
  if (user?.mustChange) return <ForcePassword />;
  return (
    <div className="app-shell min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line bg-white lg:block"><Sidebar groups={groups} pending={pending} /></aside>
      {mobile && (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <div className="drawer-scrim absolute inset-0 bg-ink/60" onClick={() => setMobile(false)} />
          <aside className="drawer-panel absolute inset-y-0 left-0 w-[288px] max-w-[86vw] bg-white">
            <button className="btn btn-ghost btn-icon absolute right-2 top-3" onClick={() => setMobile(false)} aria-label="Close menu"><X size={16} /></button>
            <Sidebar groups={groups} pending={pending} onNavigate={() => setMobile(false)} />
          </aside>
        </div>
      )}
      <div className="app-main lg:ml-[264px]">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white px-4 pt-[env(safe-area-inset-top)] sm:px-6">
          <button className="btn btn-ghost btn-icon lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={18} /></button>
          {role && canRead(role, "patients") ? <GlobalSearch /> : <span className="text-[13px] font-medium text-muted">{role ? ROLE_LABEL[role] : ""}</span>}
          <div className="ml-auto flex items-center gap-1.5">
            <button className="btn btn-ghost btn-icon" onClick={() => loadAll()} aria-label="Refresh records"><RefreshCw size={15} /></button>
            <span className="hidden pr-3 text-xs text-muted md:block">{dayName(ANCHOR)}, {fmtDate(ANCHOR)}</span>
            <Link href={bellHref} className="btn btn-ghost btn-icon relative" aria-label={`${alerts} items need attention`}>
              <Bell size={17} />
              {alerts > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-semibold text-white">{alerts}</span>}
            </Link>
            <div className="relative">
              <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label="Account menu">
                <Avatar name={user?.name || "User"} size={30} />
                <span className="hidden text-left leading-tight sm:block"><span className="block text-[13px] font-medium">{user?.name}</span><span className="block text-[11.5px] text-muted">{role ? ROLE_LABEL[role] : ""}</span></span>
                <ChevronDown size={14} className="text-faint" />
              </button>
              {menu && (
                <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-xl" onMouseLeave={() => setMenu(false)}>
                  <div className="border-b border-line-2 px-3.5 py-2 text-xs text-muted [overflow-wrap:anywhere]">{user?.email}</div>
                  <Link href="/settings" onClick={() => setMenu(false)} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:bg-surface"><Settings size={15} />Settings</Link>
                  <a href="/" onClick={() => setMenu(false)} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] hover:bg-surface"><Globe size={15} />Hospital website</a>
                  <button className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] hover:bg-surface" onClick={() => signOut()}><LogOut size={15} />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-8">{canOpen(role, pathname) ? children : <NoAccess role={role} />}</main>
      </div>
      <BottomNav role={role} onMore={() => setMobile(true)} />
      <ToastHost />
    </div>
  );
}
