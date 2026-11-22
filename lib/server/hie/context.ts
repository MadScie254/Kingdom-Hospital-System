import { hieApi, type HieApi } from "../../hie/api";
import { HieClient, type LogEntry } from "../../hie/client";
import { HieError, friendlyMessage } from "../../hie/errors";
import { parseKephLevel } from "../../hie/rules";
import type { Session } from "../auth";
import type { Sql } from "../db";
import { HttpError } from "../http";
import { background } from "../mail";

/** Facility details live in Settings. The credentials live in Worker secrets and are read here, never stored or sent to the browser. */
export type Facility = { frCode: string; mflCode: string; kephLevel: number | null; name: string; email: string };
export type HieCtx = { s: Sql; u: Session; api: HieApi; client: HieClient; facility: Facility; action: string };

const env = (k: string) => (process.env[k] || "").trim();

export function hieEnv() {
  return {
    baseUrl: env("DHA_BASE_URL"),
    clientId: env("DHA_CLIENT_ID"),
    clientSecret: env("DHA_CLIENT_SECRET"),
    /** Set DHA_FACILITY_HEADERS=off when the credentials already carry the facility. */
    sendFacilityHeaders: env("DHA_FACILITY_HEADERS").toLowerCase() !== "off",
    terminologyOwner: env("DHA_TERMINOLOGY_OWNER") || "ORG-00002",
    icd11Source: env("DHA_ICD11_SOURCE"),
    interventionSource: env("DHA_INTERVENTIONS_SOURCE") || "BenefitsAndInterventions",
    callbackSecret: env("DHA_CALLBACK_SECRET"),
  };
}
export const hieConfigured = () => { const e = hieEnv(); return !!(e.baseUrl && e.clientId && e.clientSecret); };

export async function loadFacility(s: Sql): Promise<Facility> {
  const [row] = await s.query(`select data from settings order by id limit 1`);
  const d = (row?.data || {}) as Record<string, any>;
  return { frCode: String(d.frCode || "").trim(), mflCode: String(d.mflCode || "").trim(), kephLevel: parseKephLevel(d.kephLevel), name: String(d.name || ""), email: String(d.email || "").trim() };
}

/** One row in hie_log per attempt. Written after the response goes out so it never slows a screen down. */
function logger(s: Sql, u: Session, action: string) {
  return (e: LogEntry) => {
    background(
      s.query(
        `insert into hie_log (actor, action, method, path, query_keys, status, ms, ok, attempt, error, request_id) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [u.email, action, e.method, e.path, e.queryKeys.join(","), e.status, e.ms, e.ok, e.attempt, e.error || null, e.requestId || null],
      ),
    );
  };
}

export async function buildCtx(s: Sql, u: Session, action: string): Promise<HieCtx> {
  const e = hieEnv();
  if (!hieConfigured()) throw new HieError({ kind: "not_configured", message: "The connection to SHA is not set up." });
  const facility = await loadFacility(s);
  const client = new HieClient(
    { baseUrl: e.baseUrl, clientId: e.clientId, clientSecret: e.clientSecret, facilityId: e.sendFacilityHeaders && facility.frCode ? facility.frCode : undefined, facilityIdType: "fr-code" },
    { onLog: logger(s, u, action) },
  );
  return { s, u, api: hieApi(client), client, facility, action };
}

/** SHA's answers become API errors the screens can show. A 401 from SHA is sent as 502 so it never signs a member of staff out. */
export function toHttpError(e: unknown): HttpError | null {
  if (!(e instanceof HieError)) return null;
  const msg = friendlyMessage(e);
  if (e.kind === "not_configured") return new HttpError(503, msg);
  if (e.kind === "rate_limited") return new HttpError(429, msg);
  if (e.kind === "validation" || e.kind === "conflict" || e.kind === "not_found" || e.kind === "forbidden") return new HttpError(422, msg);
  return new HttpError(502, msg);
}
