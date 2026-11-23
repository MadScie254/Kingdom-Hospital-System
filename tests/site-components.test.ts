import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CataractSlider } from "../components/site/cataract-slider";
import { PortalLink } from "../components/site/portal-link";
import { Reveal } from "../components/site/reveal";
import { SiteHeader } from "../components/site/site-header";
import { DOORS, NAV, PORTAL_HOME, SITE } from "../lib/site";

// These render on the server, which is what a visitor gets before any JavaScript runs (or when it never runs).

test("without JavaScript the header has the logo link, the section links, the call link and both doors", () => {
  const html = renderToStaticMarkup(createElement(SiteHeader));
  assert.match(html, /<a [^>]*href="\/"[^>]*><img/, "the logo links to the homepage");
  for (const n of NAV) {
    assert.ok(html.includes(`href="#${n.id}"`), `link to #${n.id}`);
    assert.ok(html.includes(`>${n.label}<`), `label ${n.label}`);
  }
  assert.ok(html.includes(`href="tel:${SITE.phoneTel}"`), "call link");
  assert.ok(html.includes(SITE.phoneDisplay), "number is written out");
  assert.ok(html.includes('href="#main"'), "a skip link to the main content comes first");
  for (const d of DOORS) assert.ok(html.includes(`href="${d.href}"`), d.href);
  assert.ok(!html.includes("Open portal"), "signed out until the session answer arrives");
});

test("the menu button says what it does and points at the menu it opens", () => {
  const html = renderToStaticMarkup(createElement(SiteHeader));
  assert.match(html, /<button[^>]*aria-label="Open menu"/);
  assert.match(html, /<button[^>]*aria-expanded="false"/);
  assert.match(html, /<button[^>]*aria-controls="site-menu"/);
  assert.ok(html.includes('id="site-menu"'), "the menu the button controls exists");
  assert.ok(!html.includes('role="dialog"'), "closed menu is not announced as a dialog");
});

for (const variant of ["header", "menu", "door"] as const) {
  test(`the ${variant} sign in shows both doors until the session answer says otherwise`, () => {
    const html = renderToStaticMarkup(createElement(PortalLink, { variant }));
    for (const d of DOORS) {
      assert.ok(html.includes(`href="${d.href}"`), `${variant}: ${d.href}`);
      assert.ok(html.includes(d.title), `${variant}: ${d.title}`);
    }
    assert.ok(!html.includes(`href="${PORTAL_HOME}"`), "no portal link for a signed out visitor");
  });
}

test("a reveal keeps its content in the HTML and starts without is-in", () => {
  const html = renderToStaticMarkup(createElement(Reveal, { as: "section", delay: 120 }, "Hello there"));
  assert.ok(html.includes("Hello there"), "content is in the markup");
  assert.match(html, /^<section /);
  assert.match(html, /class="[^"]*\bsite-reveal\b/);
  assert.ok(!html.includes("is-in"), "nothing is marked as shown before the browser has looked");
  assert.ok(html.includes("--reveal-delay:120ms"), "the stagger is carried as a custom property");
  const plain = renderToStaticMarkup(createElement(Reveal, null, "x"));
  assert.match(plain, /^<div /);
  assert.ok(!plain.includes("--reveal-delay"), "no delay, no property");
});

test("the slider starts clear, is labelled, and shows the real photo with no filter", () => {
  const html = renderToStaticMarkup(createElement(CataractSlider, { src: "/images/home/building.webp", alt: "The hospital building" }));
  assert.ok(html.includes('type="range"'));
  assert.ok(html.includes('min="0"') && html.includes('max="100"') && html.includes('value="100"'));
  assert.ok(html.includes('aria-label="Compare clouded and clear vision"'));
  assert.ok(html.includes('aria-valuetext="100 percent clear"'));
  assert.ok(html.includes('src="/images/home/building.webp"') && html.includes('alt="The hospital building"'));
  assert.ok(!/blur\(/.test(html), "no blur while clear");
});
