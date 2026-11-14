"use client";
import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Badge, toast } from "./ui";
import { fmtDateTime } from "@/lib/format";

type B = { id: number; at: string; ok: boolean; trigger: string; tables: number | null; rows: number | null; bytes: number | null; note: string | null };
const eat = (t: string) => fmtDateTime(new Date(Date.parse(t) + 3 * 3600e3).toISOString().slice(0, 16));
const size = (b: number | null) => (b == null ? "" : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function Backups() {
  const [list, setList] = useState<B[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setList((await api<{ backups: B[] }>("/api/backup")).backups); } catch { setList([]); } }, []);
  useEffect(() => { load(); }, [load]);
  const run = async () => {
    setBusy(true);
    try { const r = await api<{ rows: number }>("/api/backup", { method: "POST", body: {} }); toast(`Backup saved, ${r.rows} records`); load(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Could not reach the server."); }
    setBusy(false);
  };
  const last = list?.find((b) => b.ok);
  return (
    <section className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
      <div>
        <h2 className="card-title">Backups</h2>
        <p className="mt-1 text-[13px] text-muted">A full copy of every record is saved every night at midnight, Nairobi time, and kept for 35 days in separate storage.</p>
        <button className="btn btn-primary mt-4" onClick={run} disabled={busy}><DatabaseBackup size={15} />{busy ? "Saving" : "Back up now"}</button>
      </div>
      <div>
        <p className="mb-3 text-[13px]">{list === null ? "Loading" : last ? <>Last good backup: <strong>{eat(last.at)}</strong></> : <span className="text-bad">No successful backup yet. Press Back up now.</span>}</p>
        <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
          <table className="tbl"><thead><tr><th>When</th><th>Type</th><th>Records</th><th>Size</th><th>Result</th></tr></thead>
            <tbody>{(list || []).map((b) => <tr key={b.id}><td className="whitespace-nowrap">{eat(b.at)}</td><td>{b.trigger === "nightly" ? "Nightly" : "Manual"}</td><td className="num">{b.rows ?? ""}</td><td className="whitespace-nowrap">{size(b.bytes)}</td><td>{b.ok ? <Badge tone="ok">Saved</Badge> : <Badge tone="bad">Failed</Badge>}</td></tr>)}</tbody></table>
        </div>
      </div>
    </section>
  );
}
