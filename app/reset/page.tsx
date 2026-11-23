"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { HomeLogo } from "@/components/logo";
import { api, ApiError } from "@/lib/api";

export default function Reset() {
  const [token, setToken] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
    window.history.replaceState(null, "", "/reset");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (next !== again) { setErr("The two passwords do not match."); return; }
    setBusy(true);
    try { await api("/api/reset", { method: "POST", body: { token, password: next } }); setDone(true); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Could not reach the server. Check your connection and try again."); }
    setBusy(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-50 p-5">
      <div className="w-full max-w-[420px] rounded-xl border border-line bg-white p-7 sm:p-8">
        <HomeLogo height={52} />
        {token === null ? null : done ? (
          <div className="mt-6">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ok-50 text-ok"><CheckCircle2 size={24} /></span>
            <h1 className="mt-4 text-xl font-semibold">Password changed</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">You can now sign in with your new password.</p>
            <Link href="/login" className="btn btn-primary mt-6 h-10 w-full">Sign in</Link>
          </div>
        ) : !token ? (
          <div className="mt-6">
            <h1 className="text-xl font-semibold">This link is not valid</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">Open the link from the email exactly as it was sent, or ask for a new one.</p>
            <Link href="/forgot" className="btn btn-primary mt-6 h-10 w-full">Ask for a new link</Link>
          </div>
        ) : (
          <form className="mt-6" onSubmit={submit}>
            <h1 className="text-xl font-semibold">Choose a new password</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">At least 10 characters. A long phrase is best. Do not use your email name.</p>
            <div className="mt-5 space-y-4">
              <label className="block"><span className="label">New password</span><input className="input h-10" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} required autoFocus /></label>
              <label className="block"><span className="label">Repeat new password</span><input className="input h-10" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={10} required /></label>
            </div>
            {err && <p className="mt-4 rounded-md bg-bad-50 px-3 py-2 text-[13px] text-bad" role="alert">{err}</p>}
            <button className="btn btn-primary mt-5 h-10 w-full" disabled={busy}>{busy ? "Saving" : "Save new password"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
