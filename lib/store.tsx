"use client";
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "@/components/ui";
import { api, ApiError } from "./api";
import type { Role } from "./access";
import { emptyDB, type CollectionName, type DB, type Row } from "./collections";
import { isPublicPage } from "./site";

export type User = { id: number; email: string; name: string; role: Role; departments: number[]; position?: string | null; mustChange?: boolean };
type Status = "loading" | "ready" | "unauth" | "error";

/** Text the screens read with string methods. A row saved or imported without one is given an empty value so a single odd row cannot break a screen. */
const TEXT: Partial<Record<CollectionName, string[]>> = {
  patients: ["mrn", "name", "phone", "dob", "registered"],
  visits: ["date", "complaint", "diagnosis", "treatment", "status"],
  appointments: ["date", "status", "reason", "type"],
  labOrders: ["orderedAt", "status"],
  prescriptions: ["date"],
  pharmacySales: ["date"],
  payments: ["invoiceNo", "date", "method"],
  expenses: ["date", "description", "category"],
  emergencies: ["type", "description", "status", "priority", "arrived"],
  admissions: ["admittedAt", "diagnosis", "status"],
  invoices: ["no", "date", "dueDate", "status"],
  dental: ["date", "complaint", "status"],
  shaClaims: ["claimNo", "invoiceNo", "status"],
  medicines: ["name", "category", "expiry"],
  inventory: ["item", "category", "expiry"],
};
const LISTS: Partial<Record<CollectionName, string[]>> = {
  prescriptions: ["items"], invoices: ["items"], pharmacySales: ["lines"],
  shaClaims: ["interventions", "lines", "diagnoses", "preauths", "doctors", "attachments"],
};
function tidy(c: string, rows: Row[]): Row[] {
  const fields = TEXT[c as CollectionName] || [], lists = LISTS[c as CollectionName] || [], teeth = c === "dental";
  if (!fields.length && !lists.length && !teeth) return rows;
  return rows.map((r) => {
    let out = r;
    const fix = (k: string, v: unknown) => { if (out === r) out = { ...r }; out[k] = v; };
    for (const f of fields) if (typeof r[f] !== "string") fix(f, "");
    for (const f of lists) if (!Array.isArray(r[f])) fix(f, []);
    if (teeth && (!r.teeth || typeof r.teeth !== "object")) fix("teeth", {});
    return out;
  });
}

const EMPTY = emptyDB();
let state: DB = EMPTY;
let status: Status = "loading";
let me: User | null = null;
let pending = 0;
let loadedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const useDB = (): DB => useSyncExternalStore(subscribe, () => state, () => EMPTY);
export const useCollection = <K extends CollectionName>(name: K): DB[K] => useDB()[name];
export const useStatus = (): Status => useSyncExternalStore(subscribe, () => status, () => "loading" as Status);
export const useUser = (): User | null => useSyncExternalStore(subscribe, () => me, () => null);
export const usePending = (): number => useSyncExternalStore(subscribe, () => pending, () => 0);

export function loadAll(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await api<{ user: User; data: DB; pending?: number }>("/api/data");
      state = { ...emptyDB(), ...Object.fromEntries(Object.entries(r.data).map(([c, rows]) => [c, tidy(c, rows as Row[])])) } as DB;
      me = r.user;
      pending = r.pending || 0;
      status = "ready";
      loadedAt = Date.now();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { status = "unauth"; me = null; state = EMPTY; }
      else if (status === "loading") status = "error";
    }
    inflight = null;
    emit();
  })();
  return inflight;
}

export async function signOut() {
  try { await api("/api/logout", { method: "POST", body: {} }); } catch {}
  status = "unauth"; me = null; state = EMPTY;
  emit();
}

function merge(changes: Record<string, Row[]>) {
  const next = { ...state };
  for (const [c, rows] of Object.entries(changes)) {
    let list = [...(next[c as CollectionName] || [])];
    for (const r of tidy(c, rows)) {
      const i = list.findIndex((x) => x.id === r.id);
      if (i >= 0) list[i] = r; else list = [r, ...list];
    }
    next[c as CollectionName] = list;
  }
  state = next;
  emit();
}

function failed(e: unknown): null {
  toast(e instanceof ApiError ? e.message : "Could not reach the server. Check your connection and try again.");
  if (e instanceof ApiError && e.status === 401) { status = "unauth"; emit(); }
  return null;
}

export const db = {
  get: () => state,
  async add(name: CollectionName, row: Record<string, any>): Promise<Row | null> {
    try {
      const r = await api<{ row: Row }>(`/api/records/${name}`, { method: "POST", body: row });
      merge({ [name]: [r.row] });
      return r.row;
    } catch (e) { return failed(e); }
  },
  async update(name: CollectionName, id: number, patch: Record<string, any>): Promise<Row | null> {
    const prev = state[name].find((r) => r.id === id);
    if (prev) merge({ [name]: [{ ...prev, ...patch }] });
    try {
      const r = await api<{ row: Row }>(`/api/records/${name}/${id}`, { method: "PATCH", body: patch });
      merge({ [name]: [r.row] });
      return r.row;
    } catch (e) {
      if (prev) merge({ [name]: [prev] });
      return failed(e);
    }
  },
  async remove(name: CollectionName, id: number): Promise<boolean> {
    const before = state[name];
    state = { ...state, [name]: before.filter((r) => r.id !== id) };
    emit();
    try {
      await api(`/api/records/${name}/${id}`, { method: "DELETE" });
      return true;
    } catch (e) {
      state = { ...state, [name]: before };
      emit();
      failed(e);
      return false;
    }
  },
  /** Run a server workflow. Resolves to the action's result, or null after showing the error. */
  async action(name: string, body: Record<string, any>): Promise<Record<string, any> | null> {
    try {
      const r = await api<{ changes: Record<string, Row[]>; result?: Record<string, any> }>(`/api/actions/${name}`, { method: "POST", body });
      merge(r.changes || {});
      return r.result ?? {};
    } catch (e) { return failed(e); }
  },
  /** Run a SHA step through the HIE route. The credentials and consent tokens stay on the server. Returns the error text instead of a toast when `quiet` is set, so a screen can show it beside the form. */
  async hie(name: string, body: Record<string, any> = {}, quiet = false): Promise<Record<string, any> | null> {
    try {
      const r = await api<{ changes?: Record<string, Row[]>; result?: Record<string, any> }>(`/api/hie/${name}`, { method: "POST", body });
      merge(r.changes || {});
      if (r.result?.auditFailed) toast("Done with SHA, but the audit record could not be saved. Tell an administrator.");
      return r.result ?? {};
    } catch (e) {
      if (quiet && e instanceof ApiError && e.status !== 401) return { error: e.message };
      return failed(e);
    }
  },
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // The public homepage shows no portal data. Loading it there would send a visitor a 401 and a signed in member of staff the whole database.
    if (isPublicPage(window.location.pathname)) return;
    loadAll();
    const refresh = () => { if (document.visibilityState === "visible" && status === "ready" && Date.now() - loadedAt > 60_000) loadAll(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  return <>{children}</>;
}

export function useLookup() {
  const d = useDB();
  const byId = <T extends Row>(list: T[]) => new Map(list.map((r) => [r.id, r]));
  const patients = byId(d.patients), doctors = byId(d.doctors), depts = byId(d.departments);
  return {
    patient: (id: number) => patients.get(id),
    doctor: (id: number) => doctors.get(id),
    dept: (id: number) => depts.get(id),
    patientName: (id: number) => patients.get(id)?.name ?? "Unknown patient",
    doctorName: (id: number) => doctors.get(id)?.name ?? "Unassigned",
    deptName: (id: number) => depts.get(id)?.name ?? "General",
  };
}
