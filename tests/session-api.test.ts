import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../app/api/session/route";
import { createSession } from "../lib/server/auth";

// The signing key is read when a cookie is made or checked, not when the modules load.
process.env.AUTH_SECRET = "s".repeat(40);

const ask = async (cookie?: string) => {
  const res = await GET(new Request("https://h.example/api/session", { headers: cookie ? { cookie } : {} }));
  return { res, text: await res.clone().text(), body: (await res.json()) as Record<string, unknown> };
};
const token = (role = "nurse") => createSession({ id: 1, email: "a@b.c", name: "Ann Example", role });

test("a valid session cookie says signed in and gives the role only", async () => {
  const { res, body, text } = await ask(`kh_session=${await token("nurse")}`);
  assert.equal(res.status, 200);
  assert.deepEqual(body, { signedIn: true, role: "nurse" });
  assert.ok(!text.includes("a@b.c") && !text.includes("Ann"), "no name or email is sent");
});

test("no cookie, a tampered cookie, garbage and an expired cookie all say signed out", async () => {
  const good = await token();
  const [payload, sig] = good.split(".");
  const flipped = `${payload.slice(0, -2)}${payload.slice(-2) === "AA" ? "BB" : "AA"}.${sig}`;
  const realNow = Date.now;
  Date.now = () => realNow() - 13 * 3600e3;
  const expired = await token();
  Date.now = realNow;
  for (const cookie of [undefined, `kh_session=${flipped}`, "kh_session=garbage", "kh_session=a.b", "kh_session=", `kh_session=${expired}`, "other=1"]) {
    const { res, body } = await ask(cookie);
    assert.equal(res.status, 200, String(cookie));
    assert.deepEqual(body, { signedIn: false }, String(cookie));
  }
});

test("the answer is never cached", async () => {
  const { res } = await ask();
  assert.equal(res.headers.get("cache-control"), "no-store");
});
