import type { Role } from "../access";

const enc = new TextEncoder();
const COOKIE = "kh_session";
const MAX_AGE = 12 * 3600;

/** `sv` is the account's session version when the cookie was made. Changing the password bumps it in the database, which ends every older cookie. */
export type Session = { uid: number; email: string; name: string; role: Role; exp: number; sv: number };

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET is missing or too short");
  return s;
}
const key = (usage: KeyUsage[]) => crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, usage);

export async function createSession(u: { id: number; email: string; name: string; role: string; sv?: number }): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ uid: u.id, email: u.email, name: u.name, role: u.role, sv: Number(u.sv) || 0, exp: Date.now() + MAX_AGE * 1000 })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(["sign"]), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function readSession(req: Request): Promise<Session | null> {
  const raw = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const token = raw.slice(COOKIE.length + 1);
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await key(["verify"]), fromB64url(sig), enc.encode(payload));
    if (!valid) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Session;
    if (!(s.exp > Date.now())) return null;
    return { ...s, sv: Number(s.sv) || 0 }; // cookies made before session versions existed count as version 0
  } catch {
    return null;
  }
}

export const sessionCookie = (token: string) => `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
