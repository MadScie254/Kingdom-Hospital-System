import type { Metadata } from "next";
import { SITE, jsonLd } from "./site";
import { META, PHOTOS } from "./site-content";

/**
 * What search engines and link previews read from the homepage. The root layout says noindex for the portal, so this overrides it for `/` only.
 * The title is absolute because the layout's template would add the hospital's name a second time.
 */
export function pageMetadata(origin: string): Metadata {
  return {
    metadataBase: new URL(origin),
    title: { absolute: META.title },
    description: META.description,
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    // The number is already a real link. Without this a phone browser also paints its own blue link over it.
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: "website",
      url: "/",
      siteName: SITE.name,
      locale: "en_KE",
      title: META.title,
      description: META.description,
      images: [{ url: "/og.jpg", width: 1200, height: 630, alt: PHOTOS.building.alt }],
    },
    twitter: { card: "summary_large_image", title: META.title, description: META.description, images: ["/og.jpg"] },
  };
}

/** The structured data as text that is safe inside a script tag: a "<" in a value could otherwise close the tag early. */
export function jsonLdString(origin: string): string {
  return JSON.stringify(jsonLd(origin)).replace(/</g, "\\u003c");
}
