import { NextResponse } from "next/server";
import { readSession, type Session } from "./auth";
import type { Role } from "../access";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const ok = (data: unknown, init?: ResponseInit) =>
  NextResponse.json(data, { ...init, headers: { "cache-control": "no-store", ...(init?.headers || {}) } });
export const fail = (status: number, error: string) => ok({ error }, { status });

export async function readBody<T = any>(req: Request, max = 1_000_000): Promise<T> {
  try {
    const text = await req.text();
    if (text.length > max) throw new Error("too large");
    const v = JSON.parse(text || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("not an object");
    return v as T;
  } catch {
    throw new HttpError(400, "Invalid request.");
  }
}

export function handle<C = any>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (e: any) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      const code = e?.code || e?.sourceError?.code;
      if (code === "23505") return fail(409, "That record already exists or conflicts with another record.");
      if (code === "22012") return fail(401, "Your access has changed. Sign in again.");
      if (code === "23514") return fail(409, "Not enough stock for that quantity.");
      console.error("api error", e?.message || e);
      return fail(500, "The server could not complete that. Try again.");
    }
  };
}

/** Require a signed in user. Writes must carry the custom header, which blocks cross site form posts. */
export async function requireUser(req: Request, opts: { write?: boolean; admin?: boolean; roles?: Role[] } = {}): Promise<Session> {
  const s = await readSession(req);
  if (!s) throw new HttpError(401, "Sign in to continue.");
  if (opts.write && req.headers.get("x-requested-with") !== "kh") throw new HttpError(403, "Request blocked.");
  if (opts.admin && s.role !== "admin") throw new HttpError(403, "Only an administrator can do that.");
  if (opts.roles && !opts.roles.includes(s.role)) throw new HttpError(403, "Your role cannot do that.");
  return s;
}
