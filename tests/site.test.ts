import assert from "node:assert/strict";
import { test } from "node:test";
import { FALLS_CREDIT, PORTAL_HOME, SITE, allowedForMode, jsonLd, loginMode } from "../lib/site";

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
