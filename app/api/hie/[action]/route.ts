import { guard, sql } from "@/lib/server/db";
import { HIE_ACTIONS, PLAIN_ACTIONS } from "@/lib/server/hie/actions";
import { buildCtx, toHttpError } from "@/lib/server/hie/context";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

type Ctx = { params: Promise<{ action: string }> };

/** Every call to SHA goes through here, so the browser never sees a credential, a consent token or an OTP that is not its own input. */
export const POST = handle<Ctx>(async (req, { params }) => {
  const name = (await params).action;
  // Own keys only, so a name such as constructor or __proto__ is an unknown action and not an inherited property.
  const plain = Object.hasOwn(PLAIN_ACTIONS, name) ? PLAIN_ACTIONS[name] : undefined;
  const full = Object.hasOwn(HIE_ACTIONS, name) ? HIE_ACTIONS[name] : undefined;
  const def = plain || full;
  if (!def) throw new HttpError(404, "Unknown action.");
  const u = await requireUser(req, { write: true, roles: def.roles });
  const s = sql();
  await guard(s, u);
  const body = await readBody(req, 20_000_000);
  try {
    if (plain) return ok(await plain.run(s, u, body));
    const ctx = await buildCtx(s, u, name);
    const out = await full!.run(ctx, body);
    // The SHA step went through. If its audit record could not be saved the person is told, so it is not lost quietly.
    if (ctx.audit.failed) out.result = { ...(out.result || {}), auditFailed: true };
    return ok(out);
  } catch (e) {
    const h = toHttpError(e);
    if (h) throw h;
    throw e;
  }
});
