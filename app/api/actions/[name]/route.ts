import { ACTION_ROLES } from "@/lib/access";
import { ACTIONS } from "@/lib/server/actions";
import { sql } from "@/lib/server/db";
import { handle, HttpError, ok, readBody, requireUser } from "@/lib/server/http";

type Ctx = { params: Promise<{ name: string }> };

export const POST = handle<Ctx>(async (req, { params }) => {
  const name = (await params).name;
  const action = Object.hasOwn(ACTIONS, name) ? ACTIONS[name] : undefined; // own keys only, so constructor is not an action
  if (!action) throw new HttpError(404, "Unknown action.");
  const u = await requireUser(req, { write: true, roles: (Object.hasOwn(ACTION_ROLES, name) && ACTION_ROLES[name]) || [] });
  return ok(await action(sql(), u, await readBody(req)));
});
