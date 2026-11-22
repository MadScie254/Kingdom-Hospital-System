"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { loadAll, signOut, useUser } from "@/lib/store";
import { Logo } from "./logo";

/** Shown instead of the app when an account still has a temporary password. */
export function ForcePassword() {
  const user = useUser();
  const [v, setV] = useState({ current: "", next: "", again: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (v.next !== v.again) { setErr("The new passwords do not match."); return; }
    setBusy(true);
    try { await api("/api/me/password", { method: "POST", body: { current: v.current, next: v.next } }); await loadAll(); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Could not reach the server."); setBusy(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface p-5">
      <form onSubmit={submit} className="card w-full max-w-[420px] p-7">
        <Logo height={52} />
        <h1 className="mt-6 text-xl font-semibold">Choose your own password</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Hello {user?.name}. You are signed in with a temporary password. Set one only you know before you continue. Use a long phrase you do not use anywhere else.</p>
        <div className="mt-5 space-y-4">
          <label className="block"><span className="label">Temporary password</span><input className="input h-10" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} required /></label>
          <label className="block"><span className="label">New password</span><input className="input h-10" type="password" autoComplete="new-password" minLength={10} value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} required /></label>
          <label className="block"><span className="label">Repeat new password</span><input className="input h-10" type="password" autoComplete="new-password" minLength={10} value={v.again} onChange={(e) => setV({ ...v, again: e.target.value })} required /></label>
        </div>
        {err && <p className="mt-4 rounded-md bg-bad-50 px-3 py-2 text-[13px] text-bad" role="alert">{err}</p>}
        <button className="btn btn-primary mt-5 h-10 w-full" disabled={busy}>{busy ? "Saving" : "Save password and continue"}</button>
        <button type="button" className="btn btn-ghost mt-2 h-9 w-full" onClick={() => signOut()}>Sign out</button>
      </form>
    </div>
  );
}
