import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

// Read the Worker's APP_ORIGIN at request time, not at build time (the build does not have it).
export const dynamic = "force-dynamic";

/** One public page. The sign in pages are not listed: people reach them from the homepage. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteOrigin()}/`, changeFrequency: "monthly", priority: 1 }];
}
