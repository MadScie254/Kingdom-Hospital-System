import { HieClient, createTokenStore, type HieConfig, type LogEntry } from "../../lib/hie/client";

export type Call = { url: URL; method: string; headers: Headers; body: BodyInit | null | undefined };
export type Handler = (call: Call, n: number) => Response | Promise<Response>;

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });

export const tokenReply = (expires = 3600, token = "tok-1") => json({ access_token: token, expires_in: expires, token_type: "Bearer" });

/** A client wired to a fake network, a fake clock and a sleep that returns at once and remembers what it was asked. */
export function harness(handler: Handler, cfg: Partial<HieConfig> = {}) {
  const calls: Call[] = [];
  const logs: LogEntry[] = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const fetchMock = (async (input: URL | string, init?: RequestInit) => {
    const call: Call = { url: new URL(String(input)), method: init?.method || "GET", headers: new Headers(init?.headers), body: init?.body };
    calls.push(call);
    const signal = init?.signal;
    const reply = Promise.resolve(handler(call, calls.length));
    if (!signal) return reply;
    return Promise.race([reply, new Promise<Response>((_, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))]);
  }) as unknown as typeof fetch;
  const client = new HieClient(
    { baseUrl: "https://hie.test/api/v1/", clientId: "id-1", clientSecret: "secret-1", ...cfg },
    { fetch: fetchMock, sleep: async (ms) => { sleeps.push(ms); }, now: () => clock, random: () => 0, onLog: (e) => { logs.push(e); }, tokens: createTokenStore() },
  );
  return { client, calls, logs, sleeps, advance: (ms: number) => { clock += ms; } };
}

export const bodyOf = async (b: BodyInit | null | undefined) => (typeof b === "string" ? b : b instanceof URLSearchParams ? b.toString() : "");
