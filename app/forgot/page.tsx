"use client";
import Link from "next/link";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { HomeLogo } from "@/components/logo";
import { api, ApiError } from "@/lib/api";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await api("/api/forgot", { method: "POST", body: { email, website } }); setDone(true); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Could not reach the server. Check your connection and try again."); }
    setBusy(false);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-50 p-5">
      <div className="w-full max-w-[420px] rounded-xl border border-line bg-white p-7 sm:p-8">
        <HomeLogo height={52} />
        {done ? (
          <div className="mt-6">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ok-50 text-ok"><MailCheck size={24} /></span>
            <h1 className="mt-4 text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">If {email.trim()} belongs to an active account, we sent a link to choose a new password. It works once, for one hour. Look in the spam folder too.</p>
            <Link href="/login" className="btn btn-primary mt-6 h-10 w-full">Back to sign in</Link>
          </div>
        ) : (
          <form className="mt-6" onSubmit={submit}>
            <h1 className="text-xl font-semibold">Forgot your password?</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">Enter the email you sign in with. We will email you a link to choose a new one.</p>
            <label className="mt-5 block"><span className="label">Email</span><input className="input h-10" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus /></label>
            <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
            {err && <p className="mt-4 rounded-md bg-bad-50 px-3 py-2 text-[13px] text-bad" role="alert">{err}</p>}
            <button className="btn btn-primary mt-5 h-10 w-full" disabled={busy}>{busy ? "Sending" : "Email me a link"}</button>
            <p className="mt-5 text-center text-[13px] text-muted"><Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link></p>
          </form>
        )}
      </div>
    </main>
  );
}
