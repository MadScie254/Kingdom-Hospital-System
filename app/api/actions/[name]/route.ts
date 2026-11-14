import { ACTION_ROLES } from "@/lib/access";
import { ACTIONS } from "@/lib/server/actions";
import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

type Ctx = { params: Promise<{ name: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const action = ACTIONS[(await params).name];
  if (!action) throw new HttpError(404, "Unknown action.");
  const u = await requireUser(req, { write: true, roles: ACTION_ROLES[(await params).name] || [] });
  return ok(await action(sql(), u, await readBody(req)));
});
