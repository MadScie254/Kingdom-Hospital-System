import { clearCookie } from "@/lib/server/auth";
import { handle, ok } from "@/lib/server/http";

export const POST = handle(async () => {
  const res = ok({ ok: true });
  res.headers.append("set-cookie", clearCookie());
  return res;
});
