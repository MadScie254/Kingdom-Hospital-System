import { HomePage } from "@/components/site/home-page";
import { siteOrigin } from "@/lib/site";
import { jsonLdString, pageMetadata } from "@/lib/site-seo";
import "./home.css";

/** Prerendered at build time: nothing here reads the request, so a visit costs no CPU. */
export const metadata = pageMetadata(siteOrigin());

/**
 * The public homepage. The font is preloaded because the hero is set in it. The JSON-LD block describes the hospital to search engines;
 * it is data, not a script, so the Content Security Policy does not apply to it.
 */
export default function Page() {
  return (
    <>
      <link rel="preload" href="/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(siteOrigin()) }} />
      <HomePage />
    </>
  );
}
