import assert from "node:assert/strict";
import { test } from "node:test";
import { DOORS, FALLS_CREDIT, NAV, PORTAL_HOME, SITE, allowedForMode, isPublicPage, jsonLd, loginMode, parseSessionAnswer } from "../lib/site";

test("the phone number is shown and linked with the same digits", () => {
  assert.equal(SITE.phoneDisplay, "0742 007 277");
  assert.equal(SITE.phoneTel, "+254742007277");
  const shown = SITE.phoneDisplay.replace(/\D/g, "");
  const linked = SITE.phoneTel.replace(/\D/g, "");
  assert.equal(`254${shown.slice(1)}`, linked);
});

test("the portal home is the dashboard", () => {
  assert.equal(PORTAL_HOME, "/dashboard");
});

test("the sign in door comes from ?as= and defaults to staff", () => {
  assert.equal(loginMode("?as=admin"), "admin");
  assert.equal(loginMode("as=admin"), "admin");
  assert.equal(loginMode("?as=staff"), "staff");
  assert.equal(loginMode(""), "staff");
  assert.equal(loginMode("?as=x"), "staff");
  assert.equal(loginMode("?as=ADMIN"), "staff", "only the exact word opens the admin door");
  assert.equal(loginMode("?as=admin&as=staff"), "admin", "the first value wins");
  assert.equal(loginMode("?as=staff&as=admin"), "staff");
});

test("the admin door lets only administrators through and the staff door lets everyone through", () => {
  assert.equal(allowedForMode("admin", "admin"), true);
  assert.equal(allowedForMode("admin", "doctor"), false);
  assert.equal(allowedForMode("admin", "reception"), false);
  assert.equal(allowedForMode("admin", ""), false);
  assert.equal(allowedForMode("staff", "admin"), true);
  assert.equal(allowedForMode("staff", "nurse"), true);
});

test("the structured data describes a hospital that is open 24 hours", () => {
  const ld = jsonLd("https://h.example") as Record<string, any>;
  assert.ok(([] as string[]).concat(ld["@type"]).includes("Hospital"));
  assert.equal(ld.url, "https://h.example");
  assert.equal(ld.telephone, "+254742007277");
  assert.equal(ld.email, SITE.email);
  assert.equal(ld.address.addressLocality, "Matulo");
  assert.equal(ld.address.addressRegion, "Bungoma County");
  assert.equal(ld.address.addressCountry, "KE");
  const days = new Set<string>();
  for (const spec of ld.openingHoursSpecification as Array<{ dayOfWeek: string | string[]; opens: string; closes: string }>) {
    assert.equal(spec.opens, "00:00");
    assert.equal(spec.closes, "23:59");
    for (const d of ([] as string[]).concat(spec.dayOfWeek)) days.add(d);
  }
  assert.deepEqual([...days].sort(), ["Friday", "Monday", "Saturday", "Sunday", "Thursday", "Tuesday", "Wednesday"]);
});

test("the Webuye Falls photo is credited with its author, license, links and a note of the change", () => {
  assert.equal(FALLS_CREDIT.author, "Galkey");
  assert.equal(FALLS_CREDIT.license, "CC BY-SA 4.0");
  assert.equal(FALLS_CREDIT.licenseUrl, "https://creativecommons.org/licenses/by-sa/4.0/");
  assert.equal(FALLS_CREDIT.sourceUrl, "https://commons.wikimedia.org/wiki/File:Nabuloye_Falls.jpg");
  assert.match(FALLS_CREDIT.change, /cropped/i);
});

test("the structured data carries no postal code, because the sources disagree on it", () => {
  const ld = jsonLd("https://h.example") as Record<string, any>;
  assert.equal(ld.address.postalCode, undefined);
});

test("each sign in door links to the login page set to that door", () => {
  assert.deepEqual(DOORS.map((d) => d.mode), ["staff", "admin"]);
  for (const d of DOORS) {
    const url = new URL(d.href, "https://h.example");
    assert.equal(url.pathname, "/login");
    assert.equal(loginMode(url.search), d.mode, `${d.href} must open the ${d.mode} door`);
    assert.ok(d.title.length > 0 && d.blurb.length >= 20, `${d.mode} door has a title and a sentence`);
  }
});

test("the menu sections are the ids the page uses, in reading order, with no repeats", () => {
  assert.deepEqual(NAV.map((n) => n.id), ["services", "eye-care", "about", "insurance", "visit"]);
  assert.equal(new Set(NAV.map((n) => n.id)).size, NAV.length);
  for (const n of NAV) assert.match(n.id, /^[a-z]+(-[a-z]+)*$/);
});

test("the session answer is trusted only when it says signedIn is exactly true", () => {
  assert.deepEqual(parseSessionAnswer({ signedIn: true, role: "nurse" }), { signedIn: true, role: "nurse" });
  assert.deepEqual(parseSessionAnswer({ signedIn: true }), { signedIn: true, role: "" });
  const signedOut = { signedIn: false, role: "" };
  for (const bad of [null, undefined, "yes", 1, [], {}, { signedIn: "true" }, { signedIn: 1 }, { signedIn: false, role: "admin" }]) {
    assert.deepEqual(parseSessionAnswer(bad), signedOut, JSON.stringify(bad));
  }
});

test("only the homepage is a public page that must not load the portal's data", () => {
  assert.equal(isPublicPage("/"), true);
  for (const p of ["/login", "/signup", "/forgot", "/reset", "/dashboard", "/settings", "/api/data", "", "/index", "//"]) {
    assert.equal(isPublicPage(p), false, p);
  }
});
