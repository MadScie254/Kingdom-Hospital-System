import { sql } from "@/lib/server/db";
import { handle, ok } from "@/lib/server/http";

/** What the public sign in and request pages may show: hospital contact details and department names. */
export const GET = handle(async () => {
  const s = sql();
  const [settings, depts] = await s.transaction([
    s.query(`select data->>'name' as name, data->>'email' as email, data->>'phone' as phone from settings order by id limit 1`),
    s.query(`select id, data->>'name' as name from departments order by data->>'name'`),
  ]);
  return ok({ hospital: settings[0] || {}, departments: depts });
});
