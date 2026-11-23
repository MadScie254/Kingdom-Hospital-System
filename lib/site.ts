/**
 * What the public page says about the hospital. One place, read by the page, the structured data and the tests.
 * It has no imports, so tests and the Worker can use it as it is.
 */
export const SITE = {
  name: "Kingdom Faith Based Hospital",
  phoneDisplay: "0742 007 277",
  phoneTel: "+254742007277",
  email: "kingdomfaithbasedhospital@gmail.com",
  address: {
    line: "Malaha Shopping Centre, off the Webuye-Kitale road, near Malaha Market",
    locality: "Matulo",
    area: "Webuye West",
    region: "Bungoma County",
    country: "KE",
  },
  hours: "Open 24 hours, every day",
  facebook: "https://www.facebook.com/p/Kingdom-Faith-Based-Hospital-100068863128421/",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Kingdom+Faith+Based+Hospital+Malaha+Webuye",
} as const;

/** The one photo on the page that is not the hospital's own. CC BY-SA 4.0 asks for the author, the license, a link to it and a note of any change. */
export const FALLS_CREDIT = {
  title: "Webuye Falls",
  author: "Galkey",
  license: "CC BY-SA 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Nabuloye_Falls.jpg",
  change: "Cropped and resized",
} as const;

/**
 * The address the Worker is hosted at. It must equal APP_ORIGIN in wrangler.jsonc (a test checks that).
 * The homepage is prerendered at build time, where the Worker's own variables are not set, so its search tags use this unless APP_ORIGIN is in the build environment.
 */
export const FALLBACK_ORIGIN = "https://kingdom-hospital.dmwanjala254.workers.dev";

/** The public address of the site, without a trailing slash. */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  return (env.APP_ORIGIN || FALLBACK_ORIGIN).replace(/\/$/, "");
}

/** Where a signed in person lands. The logo inside the portal goes here, whatever the role. */
export const PORTAL_HOME = "/dashboard";

/**
 * Pages anyone can open, which show no portal data. The portal's store skips its first load on these:
 * a signed in member of staff would download the whole hospital's records for nothing, and a visitor would get a 401 in the console.
 */
export const PUBLIC_PAGES: readonly string[] = ["/"];

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.includes(pathname);
}

export type LoginMode = "staff" | "admin";

/** The sign in door, taken from `?as=admin` or `?as=staff`. Anything else is the staff door. */
export function loginMode(search: string): LoginMode {
  return new URLSearchParams(search).get("as") === "admin" ? "admin" : "staff";
}

/** Shown after the administrator door signs a non administrator account straight back out. The title matches the staff door's label on the switch. */
export const NOT_ADMIN_MESSAGE = "That account is not an administrator. Choose Hospital staff to sign in.";

/** The staff door lets every account in. The administrator door only lets an administrator in. */
export function allowedForMode(mode: LoginMode, role: string): boolean {
  return mode === "admin" ? role === "admin" : true;
}

/** The menu sections, in reading order. The header links to these ids and the page puts the same ids on its sections. */
export const NAV = [
  { id: "services", label: "Services" },
  { id: "eye-care", label: "Eye care" },
  { id: "about", label: "About" },
  { id: "insurance", label: "Insurance" },
  { id: "visit", label: "Visit us" },
] as const;

/** The two ways in. Each links to the login page set to that door, and `loginMode` reads the same word back. */
export const DOORS: ReadonlyArray<{ mode: LoginMode; href: string; title: string; blurb: string }> = [
  { mode: "staff", href: "/login?as=staff", title: "Hospital staff", blurb: "Doctors, nurses, reception, laboratory, pharmacy and accounts sign in here." },
  { mode: "admin", href: "/login?as=admin", title: "Administrator", blurb: "Hospital managers and system administrators sign in here." },
];

/** What the doors turn into when the browser already holds a valid session. */
export const OPEN_PORTAL = { title: "Open portal", blurb: "You are signed in. Go to your dashboard." } as const;

export type SessionAnswer = { signedIn: boolean; role: string };

/** Reads the answer of `GET /api/session`. Only `signedIn: true` counts. Anything else, including garbage, means signed out. */
export function parseSessionAnswer(value: unknown): SessionAnswer {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if (v.signedIn === true) return { signedIn: true, role: typeof v.role === "string" ? v.role : "" };
  }
  return { signedIn: false, role: "" };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Structured data for search engines. No postal code: the old site and the hospital's own records disagree on it. */
export function jsonLd(origin: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": ["Hospital", "MedicalOrganization"],
    name: SITE.name,
    url: origin,
    logo: `${origin}/logo.png`,
    image: `${origin}/og.jpg`,
    telephone: SITE.phoneTel,
    email: SITE.email,
    description: "A faith based hospital at Malaha, Webuye, with an eye clinic, cataract surgery, an operating theatre, a dental clinic and inpatient and outpatient care, open 24 hours.",
    address: {
      "@type": "PostalAddress",
      streetAddress: SITE.address.line,
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.country,
    },
    openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS, opens: "00:00", closes: "23:59" }],
    sameAs: [SITE.facebook],
  };
}
