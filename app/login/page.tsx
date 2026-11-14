"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { api, ApiError } from "@/lib/api";
import { loadAll, useStatus } from "@/lib/store";

function FloorMotif() {
  const rooms = [[40, 60, 150, 100], [190, 60, 110, 100], [300, 60, 150, 100], [40, 160, 90, 120], [130, 160, 170, 120], [300, 160, 150, 120], [40, 300, 190, 90], [230, 300, 220, 90]];
  return (
    <svg viewBox="0 0 490 440" className="pointer-events-none absolute -bottom-10 -right-20 w-[460px] opacity-[0.55]" fill="none" stroke="#c9dcef" strokeWidth="1.6" aria-hidden>
      {rooms.map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)}
      {[[70, 90], [215, 90], [330, 90], [330, 190], [70, 330], [260, 330]].map(([x, y], i) => <g key={i}><rect x={x} y={y} width="34" height="18" rx="2" /><path d={`M${x + 8} ${y} v18`} /></g>)}
    </svg>
  );
}

export default function Login() {
  const router = useRouter();
  const status = useStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (status === "ready") router.replace("/dashboard"); }, [status, router]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    try {
      await api("/api/login", { method: "POST", body: { email: f.get("email"), password: f.get("password") } });
      await loadAll();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-brand-50 p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo height={84} />
        <div className="relative z-10 max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15] text-text">Every patient, bed and bill, in one record.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">Registration, clinics, laboratory, wards, pharmacy and SHA claims share one source of truth, so the front desk and the ward always see the same patient.</p>
        </div>
        <div className="relative z-10 text-xs text-muted">Kingdom Faith Based Hospital, Webuye</div>
        <FloorMotif />
      </section>
      <section className="flex items-center justify-center bg-white p-6 sm:p-12">
        <form className="w-full max-w-[380px]" onSubmit={submit}>
          <div className="mb-8 lg:hidden"><Logo height={60} /></div>
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1.5 text-[13px] text-muted">Use the email and password your administrator gave you.</p>
          <div className="mt-7 space-y-4">
            <label className="block"><span className="label">Email</span><input className="input h-10" name="email" type="email" autoComplete="username" required autoFocus /></label>
            <label className="block"><span className="label">Password</span><input className="input h-10" name="password" type="password" autoComplete="current-password" required /></label>
          </div>
          {error && <p className="mt-4 rounded-md bg-bad-50 px-3 py-2 text-[13px] text-bad" role="alert">{error}</p>}
          <button className="btn btn-primary mt-6 h-10 w-full" disabled={busy}>{busy ? "Signing in" : "Sign in"}</button>
          <p className="mt-6 text-center text-[13px] text-muted">New to the hospital? <Link href="/signup" className="font-medium text-brand hover:underline">Request access</Link></p>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted">Forgot your password? Ask the administrator to reset it. Patient records are confidential and every change is logged against your name.</p>
        </form>
      </section>
    </div>
  );
}
