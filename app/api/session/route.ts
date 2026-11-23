import { readSession } from "@/lib/server/auth";
import { ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Tells the public pages whether this browser holds a valid session cookie, so the homepage can offer Open portal.
 * It reads the cookie only: no database, and no name or email in the answer. The portal itself still checks every request.
 */
export async function GET(req: Request) {
  const s = await readSession(req);
  return ok(s ? { signedIn: true, role: s.role } : { signedIn: false });
}
