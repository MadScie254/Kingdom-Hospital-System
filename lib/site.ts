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

/** Where a signed in person lands. The logo inside the portal goes here, whatever the role. */
export const PORTAL_HOME = "/dashboard";

export type LoginMode = "staff" | "admin";

/** The sign in door, taken from `?as=admin` or `?as=staff`. Anything else is the staff door. */
export function loginMode(search: string): LoginMode {
  return new URLSearchParams(search).get("as") === "admin" ? "admin" : "staff";
}

/** The staff door lets every account in. The administrator door only lets an administrator in. */
export function allowedForMode(mode: LoginMode, role: string): boolean {
  return mode === "admin" ? role === "admin" : true;
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
