"use client";
import { useEffect, useSyncExternalStore } from "react";
import { buildSeed, type DB, type CollectionName, type Row } from "./seed";

const KEY = "kingdom.hospital.v3";
const seed = buildSeed();
let state: DB = seed;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => state, () => seed);
}
export function useCollection<K extends CollectionName>(name: K): DB[K] {
  return useDB()[name];
}

export const db = {
  get: () => state,
  add<K extends CollectionName>(name: K, row: Omit<Row, "id"> & { id?: number }): Row {
    const list = state[name] as Row[];
    const id = row.id ?? list.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    const created = { ...row, id } as Row;
    state = { ...state, [name]: [created, ...list] };
    persist(); emit();
    return created;
  },
  update<K extends CollectionName>(name: K, id: number, patch: Partial<Row>) {
    state = { ...state, [name]: (state[name] as Row[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) };
    persist(); emit();
  },
  remove<K extends CollectionName>(name: K, id: number) {
    state = { ...state, [name]: (state[name] as Row[]).filter((r) => r.id !== id) };
    persist(); emit();
  },
  reset() {
    state = buildSeed();
    persist(); emit();
  },
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw) as DB; emit(); }
    } catch {}
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
