"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Copy, Send } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { Badge, Field, toast } from "./ui";
import { fmtDateTime } from "@/lib/format";

type Log = { id: number; at: string; to: string; kind: string; subject: string; ok: boolean; error: string | null };
type Status = { configured: boolean; hasUrl: boolean; hasToken: boolean; hint: string; alerts: string[]; sendingTo: string[]; log: Log[] };

const KIND: Record<string, string> = { access_request: "Access request alert", credentials: "Temporary password", declined: "Declined notice", reset: "Password reset", backup_failed: "Backup alert", audit_failed: "SHA audit alert", test: "Test message" };
const eat = (t: string) => fmtDateTime(new Date(Date.parse(t) + 3 * 3600e3).toISOString().slice(0, 16));
const message = (e: unknown) => (e instanceof ApiError ? e.message : "Could not reach the server.");
const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");

const script = (code: string) => `const TOKEN = "${code || "PASTE_YOUR_ACCESS_CODE_HERE"}";

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return reply({ ok: false, error: "Wrong access code" });
    MailApp.sendEmail({ to: d.to, subject: d.subject, htmlBody: d.html, body: d.text, name: d.fromName });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;

async function copy(text: string, done: string) {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { toast("Could not copy. Select the text and copy it by hand."); }
}

export function MailSettings() {
  const [s, setS] = useState<Status | null>(null);
  const [alerts, setAlerts] = useState("");
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<{ to: string; ok: boolean; error?: string }[] | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { const r = await api<Status>("/api/mail"); setS(r); setAlerts((cur) => (cur === "" ? r.alerts.join(", ") : cur)); } catch (e) { toast(message(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setErr(""); setBusy(true);
    try {
      await api("/api/mail", { method: "POST", body: { alerts, ...(url.trim() ? { url } : {}), ...(code.trim() ? { token: code } : {}) } });
      toast("Email settings saved"); setUrl(""); setCode(""); await load();
    } catch (e) { setErr(message(e)); }
    setBusy(false);
  };
  const turnOff = async () => {
    setErr(""); setBusy(true);
    try { await api("/api/mail", { method: "POST", body: { url: "" } }); toast("Email turned off"); await load(); } catch (e) { setErr(message(e)); }
    setBusy(false);
  };
  const test = async () => {
    setErr(""); setOutcome(null); setTesting(true);
    try { const r = await api<{ results: { to: string; ok: boolean; error?: string }[] }>("/api/mail/test", { method: "POST", body: {} }); setOutcome(r.results); await load(); }
    catch (e) { setErr(message(e)); }
    setTesting(false);
  };

  return (
    <section id="email" className="card grid gap-6 p-6 lg:grid-cols-[240px_1fr]">
      <div>
        <h2 className="card-title">Email</h2>
        <p className="mt-1 text-[13px] text-muted">Sends alerts to you, a temporary password to each person you approve, and password reset links.</p>
        <div className="mt-3">{s === null ? null : s.configured ? <Badge tone="ok">Connected</Badge> : <Badge tone="warn">Not set up</Badge>}</div>
      </div>

      <div className="min-w-0 max-w-2xl space-y-5">
        <Field label="Send alerts to" hint="Up to 5 addresses, separated by commas. You are told when someone asks for access and when a nightly backup fails. Left empty, every administrator is told.">
          <input className="input" value={alerts} onChange={(e) => setAlerts(e.target.value)} placeholder="name@example.com" inputMode="email" autoComplete="off" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Web app address" span={2} hint={s?.hasUrl ? `A relay is saved and ends in ${s.hint}. Paste a new address only to replace it.` : "Given by Google once you finish the steps below."}>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" autoComplete="off" />
          </Field>
          <Field label="Access code" span={2} hint={s?.hasToken ? "A code is saved. Leave empty to keep it." : "A private code that only your relay and this system share."}>
            <div className="flex gap-2">
              <input className="input flex-1 font-mono text-[13px]" value={code} onChange={(e) => setCode(e.target.value)} placeholder={s?.hasToken ? "Saved" : "Press Make a code"} autoComplete="off" spellCheck={false} />
              <button type="button" className="btn btn-secondary" onClick={() => setCode(makeCode())}>Make a code</button>
            </div>
          </Field>
        </div>

        {err && <p className="rounded-md bg-bad-50 px-3 py-2 text-[13px] text-bad" role="alert">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving" : "Save email settings"}</button>
          <button className="btn btn-secondary" onClick={test} disabled={testing || !s?.configured}><Send size={15} />{testing ? "Sending" : "Send test email"}</button>
          {s?.hasUrl && <button className="btn btn-ghost" onClick={turnOff} disabled={busy}>Turn email off</button>}
        </div>
        {outcome && (
          <ul className="space-y-1.5 text-[13px]">
            {outcome.map((o) => <li key={o.to} className={o.ok ? "text-ok" : "text-bad"}>{o.ok ? `Sent to ${o.to}. Check that inbox, and the spam folder.` : `Could not send to ${o.to}. ${o.error || ""}`}</li>)}
          </ul>
        )}

        <div className="rounded-lg border border-line">
          <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-semibold" onClick={() => setOpen(!open)} aria-expanded={open}>
            How to set up email, once, in about five minutes
            <ChevronDown size={16} className={clsx("transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="space-y-3 border-t border-line px-4 py-4 text-[13px] leading-relaxed">
              <p className="text-muted">Email goes out through a small Google script that belongs to the hospital Gmail account. It is free, and messages come from that account.</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Press <strong>Make a code</strong> above. The script below will contain it.</li>
                <li>Sign in to Google with the hospital Gmail account. Open <strong>script.google.com</strong> and press <strong>New project</strong>.</li>
                <li>Delete the sample code. Press <strong>Copy script</strong> below, paste it, and press the save icon.</li>
                <li>Press <strong>Deploy</strong>, then <strong>New deployment</strong>, and choose <strong>Web app</strong>. Set <strong>Execute as</strong> to <strong>Me</strong> and <strong>Who has access</strong> to <strong>Anyone</strong>. Press <strong>Deploy</strong>, then <strong>Authorize access</strong> and allow it.</li>
                <li>Copy the <strong>Web app</strong> address Google shows. Paste it into Web app address above and press <strong>Save email settings</strong>.</li>
                <li>Press <strong>Send test email</strong>.</li>
              </ol>
              <div className="relative">
                <pre className="scroll-thin max-h-64 overflow-auto rounded-md bg-[#f5f7fa] p-3 font-mono text-[12px] leading-5">{script(code)}</pre>
                <button type="button" className="btn btn-secondary btn-sm absolute right-2 top-2" onClick={() => copy(script(code), "Script copied")}><Copy size={13} />Copy script</button>
              </div>
              {!code && <p className="text-xs text-muted">The script shows a placeholder until you press Make a code.</p>}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-[13px] font-semibold">Recent emails</h3>
          <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
            <table className="tbl">
              <thead><tr><th>When</th><th>To</th><th>What</th><th>Result</th></tr></thead>
              <tbody>
                {(s?.log || []).map((l) => (
                  <tr key={l.id}><td className="whitespace-nowrap">{eat(l.at)}</td><td className="[overflow-wrap:anywhere]">{l.to}</td><td>{KIND[l.kind] || l.kind}</td><td>{l.ok ? <Badge tone="ok">Sent</Badge> : <span title={l.error || ""}><Badge tone="bad">Failed</Badge></span>}</td></tr>
                ))}
                {s && s.log.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted">Nothing sent yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {s?.log.some((l) => !l.ok) && <p className="mt-2 text-xs text-muted">Last problem: {s.log.find((l) => !l.ok)?.error}</p>}
        </div>
      </div>
    </section>
  );
}
