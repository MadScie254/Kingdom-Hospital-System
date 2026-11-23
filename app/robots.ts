import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site";

// Read the Worker's APP_ORIGIN at request time, not at build time (the build does not have it).
export const dynamic = "force-dynamic";

/** The homepage is public. The portal and the API are not, and nothing there is meant to be found. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/settings"] }],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
