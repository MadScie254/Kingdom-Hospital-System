import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <div className="text-5xl font-semibold text-brand">404</div>
        <h1 className="mt-3 text-xl font-semibold">This page does not exist</h1>
        <p className="mt-1 text-muted">Check the address or return to the dashboard.</p>
        <Link href="/dashboard" className="btn btn-primary mt-6">Go to dashboard</Link>
      </div>
    </div>
  );
}
