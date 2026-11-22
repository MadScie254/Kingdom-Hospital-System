import { HieError, kindForStatus, parseErrorBody } from "./errors";

/** Connection settings. The id, secret and base address come from Worker secrets, never from the database or the browser. */
export type HieConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Sent as X-Facility-Id with X-Facility-Id-Type. Leave empty when the credentials already carry the facility. */
  facilityId?: string;
  facilityIdType?: string;
  timeoutMs?: number;
  maxRetries?: number;
};

export type LogEntry = { method: string; path: string; queryKeys: string[]; status: number; ms: number; ok: boolean; attempt: number; error?: string; requestId?: string };
type Query = Record<string, string | number | boolean | null | undefined>;
export type RequestOptions = {
  query?: Query;
  json?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  /** Defaults to true for GET only. A repeat of a non idempotent POST could create a second claim, so those are not retried after an unclear failure. */
  idempotent?: boolean;
  timeoutMs?: number;
  noFacility?: boolean;
};

type TokenEntry = { token: string; type: string; expiresAt: number };
export type TokenStore = { entries: Map<string, TokenEntry>; inflight: Map<string, Promise<TokenEntry>> };
export const createTokenStore = (): TokenStore => ({ entries: new Map(), inflight: new Map() });

export type Deps = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
  onLog?: (e: LogEntry) => void | Promise<void>;
  tokens?: TokenStore;
};

/** One store per isolate, so every request on a warm Worker reuses the same token. */
const SHARED = createTokenStore();
const REFRESH_MARGIN_MS = 60_000;
const DEFAULT_TTL_MS = 5 * 60_000;
const MAX_WAIT_MS = 5_000;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryAfterMs(h: Headers | undefined, now: number): number | null {
  const v = h?.get("retry-after");
  if (!v) return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(v);
  return Number.isFinite(at) ? Math.max(0, at - now) : null;
}

export class HieClient {
  private readonly base: string;
  private readonly key: string;
  private readonly store: TokenStore;
  private readonly doFetch: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly cfg: HieConfig, private readonly deps: Deps = {}) {
    if (!cfg.baseUrl || !cfg.clientId || !cfg.clientSecret) {
      throw new HieError({ kind: "not_configured", message: "The SHA connection is missing its address, client id or client secret." });
    }
    this.base = cfg.baseUrl.replace(/\/+$/, "");
    this.key = `${this.base}|${cfg.clientId}`;
    this.store = deps.tokens ?? SHARED;
    this.doFetch = deps.fetch ?? ((input, init) => fetch(input, init));
    this.sleep = deps.sleep ?? delay;
    this.now = deps.now ?? Date.now;
    this.random = deps.random ?? Math.random;
  }

  /** The cached access token, fetched or refreshed when it is within a minute of expiring. Concurrent callers share one request. */
  async token(force = false): Promise<TokenEntry> {
    const hit = this.store.entries.get(this.key);
    if (!force && hit && hit.expiresAt > this.now()) return hit;
    const running = this.store.inflight.get(this.key);
    if (running) return running;
    const p = this.fetchToken()
      .then((t) => { this.store.entries.set(this.key, t); return t; })
      .finally(() => { this.store.inflight.delete(this.key); });
    this.store.inflight.set(this.key, p);
    return p;
  }

  forgetToken() { this.store.entries.delete(this.key); }

  private async fetchToken(): Promise<TokenEntry> {
    const body = new URLSearchParams({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret });
    let res;
    try {
      res = await this.send("POST", "/tenants/token", { auth: false, body, headers: { "content-type": "application/x-www-form-urlencoded" }, idempotent: true, timeoutMs: 15_000 });
    } catch (e) {
      if (e instanceof HieError && (e.status === 400 || e.status === 401 || e.status === 403)) {
        throw new HieError({ kind: "unauthorized", status: e.status, endpoint: "/tenants/token", message: `SHA did not accept the client id and secret. ${e.message}`.trim() });
      }
      throw e;
    }
    const data = res.data as { access_token?: unknown; expires_in?: unknown; token_type?: unknown } | null;
    if (!data || typeof data.access_token !== "string" || !data.access_token) {
      throw new HieError({ kind: "invalid_response", status: res.status, endpoint: "/tenants/token", message: "SHA answered the token request without an access token." });
    }
    const secs = Number(data.expires_in);
    const ttl = Number.isFinite(secs) && secs > 0 ? secs * 1000 : DEFAULT_TTL_MS;
    const type = typeof data.token_type === "string" && data.token_type.toLowerCase() !== "token_type" && data.token_type ? data.token_type : "Bearer";
    return { token: data.access_token, type: /^bearer$/i.test(type) ? "Bearer" : type, expiresAt: this.now() + Math.max(ttl - REFRESH_MARGIN_MS, 5_000) };
  }

  async request<T = any>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { ...(opts.headers || {}) };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.json !== undefined) { body = JSON.stringify(opts.json); headers["content-type"] = "application/json"; }
    const res = await this.send(method, path, { query: opts.query, body, headers, auth: true, idempotent: opts.idempotent ?? method === "GET", timeoutMs: opts.timeoutMs ?? (opts.form ? 60_000 : undefined), noFacility: opts.noFacility });
    return res.data as T;
  }

  get<T = any>(path: string, query?: Query, opts: Omit<RequestOptions, "query"> = {}) { return this.request<T>("GET", path, { ...opts, query }); }
  post<T = any>(path: string, json?: unknown, opts: Omit<RequestOptions, "json"> = {}) { return this.request<T>("POST", path, { ...opts, json }); }
  postForm<T = any>(path: string, form: FormData, opts: Omit<RequestOptions, "form"> = {}) { return this.request<T>("POST", path, { ...opts, form }); }
  patch<T = any>(path: string, json?: unknown, opts: Omit<RequestOptions, "json"> = {}) { return this.request<T>("PATCH", path, { ...opts, json }); }
  delete<T = any>(path: string, json?: unknown, opts: Omit<RequestOptions, "json"> = {}) { return this.request<T>("DELETE", path, { ...opts, json }); }

  private url(path: string, query?: Query) {
    const u = new URL(this.base + (path.startsWith("/") ? path : `/${path}`));
    for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
    return u;
  }

  private async send(method: string, path: string, o: { query?: Query; body?: BodyInit; headers?: Record<string, string>; auth: boolean; idempotent?: boolean; timeoutMs?: number; noFacility?: boolean }) {
    const maxRetries = this.cfg.maxRetries ?? 2;
    const timeout = o.timeoutMs ?? this.cfg.timeoutMs ?? 25_000;
    const url = this.url(path, o.query);
    const queryKeys = [...url.searchParams.keys()];
    let attempt = 0;
    let retries = 0;
    let refreshed = false;

    for (;;) {
      attempt++;
      const headers = new Headers(o.headers);
      headers.set("accept", "application/json");
      if (o.auth) {
        const t = await this.token();
        headers.set("authorization", `${t.type} ${t.token}`);
        if (this.cfg.facilityId && !o.noFacility) {
          headers.set("x-facility-id", this.cfg.facilityId);
          headers.set("x-facility-id-type", this.cfg.facilityIdType || "fr-code");
        }
      }
      const started = this.now();
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeout);
      let res: Response | undefined;
      let failure: HieError | undefined;
      let text = "";
      try {
        res = await this.doFetch(url, { method, headers, body: o.body, signal: ctl.signal });
        text = await res.text();
      } catch (e: any) {
        failure = new HieError({ kind: e?.name === "AbortError" ? "timeout" : "network", endpoint: path, message: e?.name === "AbortError" ? "SHA took too long to answer." : "Could not reach SHA." });
      } finally {
        clearTimeout(timer);
      }
      const ms = this.now() - started;

      if (res && res.ok) {
        await this.log({ method, path, queryKeys, status: res.status, ms, ok: true, attempt, requestId: res.headers.get("x-request-id") || undefined });
        let data: unknown = null;
        if (text.trim()) { try { data = JSON.parse(text); } catch { data = text; } }
        return { status: res.status, data, headers: res.headers };
      }

      if (res) {
        const parsed = parseErrorBody(res.status, text);
        failure = new HieError({ kind: kindForStatus(res.status), status: res.status, endpoint: path, message: parsed.message, issues: parsed.issues });
      }
      const err = failure as HieError;
      await this.log({ method, path, queryKeys, status: err.status, ms, ok: false, attempt, error: err.message.slice(0, 200), requestId: res?.headers.get("x-request-id") || undefined });

      // An expired or revoked token: fetch a new one and repeat once. The request was refused before it was processed.
      if (o.auth && err.status === 401 && !refreshed) { refreshed = true; this.forgetToken(); continue; }

      const again =
        retries < maxRetries &&
        (err.kind === "rate_limited" || // SHA refused it, nothing was processed
          (o.idempotent === true && (err.kind === "network" || err.kind === "timeout" || err.status === 500 || err.status === 502 || err.status === 503 || err.status === 504)));
      if (!again) throw err;
      retries++;
      const wait = Math.min(retryAfterMs(res?.headers, this.now()) ?? 300 * 2 ** (retries - 1) + this.random() * 100, MAX_WAIT_MS);
      await this.sleep(wait);
    }
  }

  private async log(e: LogEntry) {
    try { await this.deps.onLog?.(e); } catch { /* logging must never break a request */ }
  }
}
