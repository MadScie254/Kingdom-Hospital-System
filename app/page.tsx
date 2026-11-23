import { HomePage } from "@/components/site/home-page";
import "./home.css";

/**
 * The public homepage. Prerendered: nothing here reads the request, so it costs no CPU per visit.
 * The font is preloaded because the hero is set in it. Search metadata is added in app/page.tsx by the search task.
 */
export default function Page() {
  return (
    <>
      <link rel="preload" href="/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <HomePage />
    </>
  );
}
