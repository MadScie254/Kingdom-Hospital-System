import clsx from "clsx";

/** Kingdom Faith Based Hospital logo. Replace public/logo.svg to change it everywhere. */
export function Logo({ height = 48, mark = false, className }: { height?: number; mark?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mark ? "/logo-mark.svg" : "/logo.svg"} alt="Kingdom Faith Based Hospital" height={height} style={{ height }} className={clsx("block w-auto max-w-none", className)} />
  );
}

/**
 * The logo as a link to the public homepage, for the pages outside the portal (sign in, request access, reset).
 * Inside the portal the logo goes to the dashboard instead, and the loading screen keeps the plain, unlinked Logo.
 */
export function HomeLogo({ height = 48, mark = false, className }: { height?: number; mark?: boolean; className?: string }) {
  return (
    <a href="/" aria-label="Kingdom Faith Based Hospital, back to the website" className={clsx("inline-block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand", className)}>
      <Logo height={height} mark={mark} />
    </a>
  );
}
