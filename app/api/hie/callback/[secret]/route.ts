import { claimStatus, isProviderOnlyState } from "@/lib/hie/rules";
import { sql } from "@/lib/server/db";
import { hieEnv } from "@/lib/server/hie/context";
import { handle, HttpError, ok, readBody } from "@/lib/server/http";

type Ctx = { params: Promise<{ secret: string }> };
type Json = Record<string, any>;

const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
const txt = (v: unknown, n = 120) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/**
 * SHA calls this when a claim, preauthorization or authorization changes state, so nobody has to poll.
 * The secret in the address is the only check SHA can make (auth_type none), so the route answers 404 to anything else.
 * A repeated delivery is ignored: the pair of entity id and new state is stored once.
 */
export const POST = handle<Ctx>(async (req, { params }) => {
  const expected = hieEnv().callbackSecret;
  const given = (await params).secret;
  if (!expected || !same(given, expected)) throw new HttpError(404, "Not found.");
  const b = await readBody<Json>(req);
  const entity = txt(b.entity_type, 20);
  const guid = txt(b.subject_guid, 80);
  const to = txt(b.to_state, 80);
  if (!["claim", "preauth", "authorization"].includes(entity) || !guid || !to) throw new HttpError(400, "Not a status callback.");

  const s = sql();
  const consent = txt(b.consent_token, 40) || null;
  const invoice = txt(b.provider_claim_no, 40) || null;
  const [ev] = await s.query(
    `insert into hie_events (entity_type, subject_guid, from_state, to_state, consent_token, provider_claim_no, notes, sent_at) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (subject_guid, to_state) do nothing returning id`,
    [entity, guid, txt(b.from_state, 80) || null, to, consent, invoice, txt(b.notes, 300) || null, txt(b.timestamp, 60) || null],
  );
  if (!ev) return ok({ ok: true, duplicate: true });

  const [row] = await s.query(
    `select c.id, c.data from sha_claims c left join hie_consents k on k.claim_id = c.id
     where ($1::text is not null and (k.consent_token = $1 or k.auth_token = $1)) or k.claim_guid = $2 or ($3::text is not null and c.data->>'invoiceNo' = $3) limit 1`,
    [consent, guid, invoice],
  );
  if (!row) return ok({ ok: true, applied: false });

  const d = row.data as Json;
  const patch: Json = {};
  if (entity === "claim") {
    if (isProviderOnlyState(to)) patch.workflowState = to; else patch.payerState = to;
    if (txt(b.notes, 300)) patch.remarks = txt(b.notes, 300);
  } else if (entity === "authorization") {
    patch.authStatus = to;
  } else {
    const list: Json[] = Array.isArray(d.preauths) ? [...d.preauths] : [];
    const i = list.findIndex((p) => p.guid === guid);
    if (i >= 0) list[i] = { ...list[i], status: to, updatedAt: new Date().toISOString() };
    else if (list.length === 1) list[0] = { ...list[0], status: to, guid, updatedAt: new Date().toISOString() };
    patch.preauths = list;
  }
  const st = claimStatus({ workflowState: patch.workflowState ?? d.workflowState, authStatus: patch.authStatus ?? d.authStatus, payerState: patch.payerState ?? d.payerState });
  await s.transaction([
    s.query(`update sha_claims set data = data || $2::jsonb, updated_at = now() where id = $1`, [row.id, JSON.stringify({ ...patch, status: st.label, statusTone: st.tone, lastSyncedAt: new Date().toISOString() })]),
    s.query(`update hie_events set applied = true where id = $1`, [ev.id]),
    s.query(`insert into audit_log (actor, action, collection, record_id) values ('SHA', $1, 'shaClaims', $2)`, [`hie.callback.${entity}`, String(row.id)]),
  ]);
  return ok({ ok: true, applied: true });
});
