import { describeReport } from "@/lib/security-headers";

export const dynamic = "force-dynamic";

let windowStart = 0;
let seen = 0;

/**
 * Public on purpose, browsers post here without signing in. It only writes a log line to the Worker log, at most 30 a minute,
 * and keeps nothing else, so it cannot be used to fill the database or the log.
 */
export async function POST(req: Request) {
  const now = Date.now();
  if (now - windowStart > 60_000) { windowStart = now; seen = 0; }
  if (++seen <= 30) {
    try {
      const line = describeReport(JSON.parse((await req.text()).slice(0, 4000)));
      if (line) console.warn(line);
    } catch { /* a malformed report is not worth a log line */ }
  }
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
