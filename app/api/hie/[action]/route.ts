import { guard, sql } from "@/lib/server/db";
import { HIE_ACTIONS, PLAIN_ACTIONS } from "@/lib/server/hie/actions";
import { buildCtx, toHttpError } from "@/lib/server/hie/context";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

type Ctx = { params: Promise<{ action: string }> };

/** Every call to SHA goes through here, so the browser never sees a credential, a consent token or an OTP that is not its own input. */
export const POST = handle<Ctx>(async (req, { params }) => {
  const name = (await params).action;
  const plain = PLAIN_ACTIONS[name];
  const full = HIE_ACTIONS[name];
  const def = plain || full;
  if (!def) throw new HttpError(404, "Unknown action.");
  const u = await requireUser(req, { write: true, roles: def.roles });
  const s = sql();
  await guard(s, u);
  const body = await readBody(req, 20_000_000);
  try {
    if (plain) return ok(await plain.run(s, u, body));
    return ok(await full!.run(await buildCtx(s, u, name), body));
  } catch (e) {
    const h = toHttpError(e);
    if (h) throw h;
    throw e;
  }
});
