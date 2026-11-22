"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, PlugZap, Search } from "lucide-react";
import clsx from "clsx";
import { db, useDB } from "@/lib/store";
import { Badge, Field } from "./ui";
import { fmtDateTime } from "@/lib/format";

type Conn = { configured: boolean; host: string; facility: { frCode: string; mflCode: string; kephLevel: number | null; headers: boolean }; icd11Search: boolean; callbacks: boolean };
type Step = { name: string; ok: boolean; detail: string; ms: number };
type Test = { ok: boolean; steps: Step[]; host: string };
type Reg = { name: string; frCode: string; fidCode: string; kephLevel: string; type: string; ownership: string; licenseNumber: string; licenseStatus: string; licenseEnd: string; operational: string; county: string };
type Row = { id: number; at: string; actor: string; action: string; method: string; path: string; status: number | null; ms: number | null; ok: boolean; attempt: number; error: string | null };

const eat = (t: string) => fmtDateTime(new Date(Date.parse(t) + 3 * 3600e3).toISOString().slice(0, 16));
const LEVELS = ["Level 2", "Level 3", "Level 4", "Level 5", "Level 6"];

/** Connection to the Digital Health Agency (DHA) Health Information Exchange. Facility codes are edited with the other settings and saved with them. */
export function HieSettings({ v, setV }: { v: Record<string, any>; setV: (next: Record<string, any>) => void }) {
  const saved = useDB().settings[0] || {};
  const [conn, setConn] = useState<Conn | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [reg, setReg] = useState<Reg | null>(null);
  const [log, setLog] = useState<{ rows: Row[]; total: number; good: number } | null>(null);
  const [busy, setBusy] = useState<"" | "test" | "lookup">("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);

  const loadLog = useCallback(async () => {
    const r = await db.hie("log.recent", {}, true);
    if (r && !r.error) setLog({ rows: r.log || [], total: r.week?.total || 0, good: r.week?.good || 0 });
  }, []);
  useEffect(() => {
    (async () => {
      const r = await db.hie("status", {}, true);
      if (r && !r.error) setConn(r as Conn);
      loadLog();
    })();
  }, [loadLog]);

  const dirty = ["mflCode", "frCode", "kephLevel"].some((k) => String(v[k] ?? "") !== String(saved[k] ?? ""));

  const lookup = async () => {
    setErr(""); setBusy("lookup");
    const r = await db.hie("facility.lookup", { mflCode: v.mflCode, frCode: v.frCode, by: v.mflCode ? "mfl" : "fr-code" }, true);
    setBusy("");
    if (!r) return;
    if (r.error) { setErr(r.error); return; }
    const f = r.facility as Reg;
    setReg(f);
    setV({ ...v, frCode: f.frCode || f.fidCode || v.frCode, kephLevel: LEVELS.includes(f.kephLevel) ? f.kephLevel : v.kephLevel });
    loadLog();
  };
  const run = async () => {
    setErr(""); setBusy("test");
    const r = await db.hie("test", {}, true);
    setBusy("");
    if (!r) return;
    if (r.error) { setErr(r.error); return; }
    setTest(r as Test);
    if (r.facility) setReg(r.facility as Reg);
    loadLog();
  };

  const licenceTone = reg && /active|valid/i.test(reg.licenseStatus) ? "ok" : "warn";

  return (
    <section className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
      <div>
        <h2 className="card-title">SHA connection</h2>
        <p className="mt-1 text-[13px] text-muted">Links this system to the Digital Health Agency, so eligibility, consent, preauthorisations and claims go to SHA directly. Credentials are kept as secrets on the server, never in the database or in the browser.</p>
      </div>
      <div className="min-w-0 space-y-5">
        <div className="flex flex-wrap gap-2 text-[13px]">
          <Badge tone={conn?.configured ? "ok" : "warn"}>{conn ? (conn.configured ? "Credentials saved" : "Credentials missing") : "Checking"}</Badge>
          {conn?.host && <Badge tone="mute">{conn.host}</Badge>}
          {conn && <Badge tone={conn.facility.headers ? "ok" : "mute"}>{conn.facility.headers ? "Facility sent with each request" : "Facility not sent"}</Badge>}
          {conn && <Badge tone={conn.callbacks ? "ok" : "mute"}>{conn.callbacks ? "Status updates on" : "Status updates off"}</Badge>}
          {conn && <Badge tone={conn.icd11Search ? "ok" : "mute"}>{conn.icd11Search ? "ICD-11 search on" : "ICD-11 typed by hand"}</Badge>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="MFL code" hint="Master Facility List number, for example 112007.">
            <input className="input" inputMode="numeric" value={v.mflCode ?? ""} onChange={(e) => setV({ ...v, mflCode: e.target.value.trim() })} placeholder="112007" autoComplete="off" />
          </Field>
          <Field label="FR code" hint="Facility Registry code that SHA expects with every request.">
            <input className="input" value={v.frCode ?? ""} onChange={(e) => setV({ ...v, frCode: e.target.value.trim() })} placeholder="FID-112007" autoComplete="off" />
          </Field>
          <Field label="Facility level" hint="KEPH level. SHA tariffs depend on it.">
            <select className="input" value={v.kephLevel ?? ""} onChange={(e) => setV({ ...v, kephLevel: e.target.value })}>
              <option value="">Not set</option>
              {LEVELS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>
        {dirty && <p className="text-[13px] text-muted">These codes are not saved yet. Press Save settings at the top. The connection test uses the saved codes.</p>}

        {err && <p className="rounded-md bg-bad-50 px-3 py-2 text-[13px] text-bad" role="alert">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary" onClick={lookup} disabled={busy !== "" || !conn?.configured || (!v.mflCode && !v.frCode)}><Search size={15} />{busy === "lookup" ? "Looking up" : "Fill from SHA registry"}</button>
          <button className="btn btn-primary" onClick={run} disabled={busy !== "" || !conn?.configured}><PlugZap size={15} />{busy === "test" ? "Testing" : "Test connection"}</button>
        </div>
        {conn && !conn.configured && <p className="text-[13px] text-muted">SHA has not given this system its client credentials yet. Follow the steps below to add them.</p>}

        {test && (
          <ol className="space-y-2 rounded-lg border border-line p-4 text-[13px]" aria-live="polite">
            {test.steps.map((s) => (
              <li key={s.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <Badge tone={s.ok ? "ok" : "bad"}>{s.ok ? "Passed" : "Failed"}</Badge>
                <span className="font-medium">{s.name}</span>
                <span className={clsx("[overflow-wrap:anywhere]", s.ok ? "text-muted" : "text-bad")}>{s.detail}</span>
              </li>
            ))}
            <li className={clsx("pt-1 font-semibold", test.ok ? "text-ok" : "text-bad")}>{test.ok ? "The connection to SHA works." : "The connection stopped at the failed step."}</li>
          </ol>
        )}

        {reg && (
          <dl className="grid gap-x-6 gap-y-2 rounded-lg border border-line p-4 text-[13px] sm:grid-cols-2">
            <div><dt className="text-muted">Registered name</dt><dd className="font-medium">{reg.name || "Not returned"}</dd></div>
            <div><dt className="text-muted">FR code</dt><dd className="font-mono">{reg.frCode || reg.fidCode || "Not returned"}</dd></div>
            <div><dt className="text-muted">Level and type</dt><dd>{[reg.kephLevel, reg.type, reg.ownership].filter(Boolean).join(", ") || "Not returned"}</dd></div>
            <div><dt className="text-muted">County</dt><dd>{reg.county || "Not returned"}</dd></div>
            <div><dt className="text-muted">Licence</dt><dd>{reg.licenseStatus ? <Badge tone={licenceTone}>{reg.licenseStatus}</Badge> : "Not returned"} {reg.licenseEnd && <span className="text-muted">ends {reg.licenseEnd.slice(0, 10)}</span>}</dd></div>
            <div><dt className="text-muted">SHA operation status</dt><dd>{reg.operational || "Not returned"}</dd></div>
          </dl>
        )}

        <div className="rounded-lg border border-line">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
            How to get connected to SHA
            <ChevronDown size={16} className={clsx("transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="space-y-3 border-t border-line px-4 py-4 text-[13px] leading-relaxed">
              <p className="text-muted">Only a system that DHA has tested and certified can send claims. The steps run in this order.</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Register the hospital and this system on the DHA developer portal (developer.dha.go.ke) and ask for UAT client credentials.</li>
                <li>An administrator stores the credentials as secrets on the hosting account: <span className="font-mono">DHA_BASE_URL</span>, <span className="font-mono">DHA_CLIENT_ID</span> and <span className="font-mono">DHA_CLIENT_SECRET</span>. They are never typed into this screen.</li>
                <li>Enter the MFL code above, press <strong>Fill from SHA registry</strong>, then <strong>Save settings</strong>.</li>
                <li>Press <strong>Test connection</strong>. Every step must pass.</li>
                <li>Book the UAT demo with the DHA integration team and walk through the SHA, PHC and emergency scenarios in the SHA screen. The call log below is the evidence of the transactions.</li>
                <li>After certification DHA issues production credentials. Replace the three secrets and test again.</li>
              </ol>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-semibold">Recent calls to SHA</h3>
            {log && <span className="text-xs text-muted">{log.total} calls in the last 7 days, {log.good} succeeded</span>}
          </div>
          <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
            <table className="tbl">
              <thead><tr><th>When</th><th>Who</th><th>Request</th><th>Answer</th><th>Time</th></tr></thead>
              <tbody>
                {(log?.rows || []).map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{eat(l.at)}</td>
                    <td className="[overflow-wrap:anywhere]">{l.actor}</td>
                    <td className="font-mono text-[12px] [overflow-wrap:anywhere]">{l.method} {l.path}</td>
                    <td>{l.ok ? <Badge tone="ok">{l.status ?? "OK"}</Badge> : <span title={l.error || ""}><Badge tone="bad">{l.status ?? "Failed"}</Badge></span>}</td>
                    <td className="whitespace-nowrap">{l.ms != null ? `${l.ms} ms` : ""}</td>
                  </tr>
                ))}
                {log && log.rows.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">No calls yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {log?.rows.some((l) => !l.ok) && <p className="mt-2 text-xs text-muted">Last problem: {log.rows.find((l) => !l.ok)?.error}</p>}
          <p className="mt-2 text-xs text-muted">The log keeps the request path, the answer code and the time. It never keeps names, numbers, one time codes or tokens.</p>
        </div>
      </div>
    </section>
  );
}
