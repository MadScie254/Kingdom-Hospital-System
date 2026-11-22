/** Errors from the Kenya Health Information Exchange (HIE) middleware. No framework imports, so tests can load it directly. */

export type HieIssue = { severity?: string; code?: string; message: string; expression?: string[] };

export type HieErrorKind =
  | "not_configured"
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "server"
  | "invalid_response";

export class HieError extends Error {
  readonly kind: HieErrorKind;
  readonly status: number;
  readonly issues: HieIssue[];
  readonly endpoint: string;

  constructor(init: { kind: HieErrorKind; message: string; status?: number; issues?: HieIssue[]; endpoint?: string }) {
    super(init.message);
    this.name = "HieError";
    this.kind = init.kind;
    this.status = init.status ?? 0;
    this.issues = init.issues ?? [];
    this.endpoint = init.endpoint ?? "";
  }

  /** Worth trying again later without changing the request. */
  get retryable() {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "rate_limited" || this.kind === "server";
  }
}

export function kindForStatus(status: number): HieErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "validation";
}

const clip = (s: string, n = 300) => (s.length > n ? s.slice(0, n - 1) + "." : s);

/** Collects readable strings from a nested error object (Django style field errors, arrays of messages). */
function strings(v: unknown, out: string[] = [], depth = 0): string[] {
  if (out.length >= 8 || depth > 4) return out;
  if (typeof v === "string") { if (v.trim()) out.push(v.trim()); }
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out, depth + 1));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    const before = out.length;
    strings(x, out, depth + 1);
    if (out.length > before && typeof x !== "string" && !/^(message|error|detail|errors)$/.test(k)) out[before] = `${k}: ${out[before]}`;
  }
  return out;
}

/** Reads whatever an error answer looks like: a FHIR OperationOutcome, the HIE `{ "error": "..." }` shape, field errors or plain text. */
export function parseErrorBody(status: number, text: string): { message: string; issues: HieIssue[] } {
  const generic = `HTTP ${status}`;
  const body = (text || "").trim();
  if (!body) return { message: generic, issues: [] };
  let json: any;
  try { json = JSON.parse(body); } catch { json = undefined; }
  if (json === undefined) return { message: body.startsWith("<") ? generic : clip(body), issues: [] };

  if (json && typeof json === "object" && json.resourceType === "OperationOutcome") {
    const issues: HieIssue[] = (Array.isArray(json.issue) ? json.issue : []).map((i: any) => ({
      severity: i.severity,
      code: i.code,
      message: String(i.details?.text || i.diagnostics || i.details?.coding?.[0]?.display || i.code || "Rejected"),
      expression: Array.isArray(i.expression) ? i.expression.map(String) : Array.isArray(i.location) ? i.location.map(String) : undefined,
    }));
    const first = issues.find((i) => i.severity === "fatal" || i.severity === "error") || issues[0];
    return { message: clip(first ? first.message : generic), issues };
  }

  if (json && typeof json === "object") {
    for (const key of ["error", "message", "detail", "description"]) {
      const v = (json as Record<string, unknown>)[key];
      if (typeof v === "string" && v.trim()) return { message: clip(v.trim()), issues: [] };
      if (v && typeof v === "object") { const s = strings(v); if (s.length) return { message: clip(s.join("; ")), issues: [] }; }
    }
    const s = strings(json);
    if (s.length) return { message: clip(s.join("; ")), issues: [] };
  }
  if (typeof json === "string" && json.trim()) return { message: clip(json.trim()), issues: [] };
  return { message: generic, issues: [] };
}

/** A sentence safe to show to staff. SHA's own words are kept for rejections, because they say what to fix. */
export function friendlyMessage(e: unknown): string {
  if (!(e instanceof HieError)) return "Something went wrong while talking to SHA. Try again.";
  switch (e.kind) {
    case "not_configured": return "The connection to SHA is not set up yet. An administrator can add the credentials.";
    case "network": return "Could not reach SHA. Check the internet connection and try again.";
    case "timeout": return "SHA took too long to answer. Try again in a moment.";
    case "unauthorized": return "SHA did not accept the hospital's access. An administrator should check the connection in Settings.";
    case "rate_limited": return "SHA is limiting requests right now. Wait a few seconds and try again.";
    case "server": return `SHA had a problem on its side (HTTP ${e.status}). Try again in a moment.`;
    case "invalid_response": return "SHA answered in a form this system could not read.";
    default: return e.message || `SHA refused the request (HTTP ${e.status}).`;
  }
}
