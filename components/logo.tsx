import clsx from "clsx";

/** Kingdom Faith Based Hospital logo. Replace public/logo.svg to change it everywhere. */
export function Logo({ height = 48, mark = false, className }: { height?: number; mark?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mark ? "/logo-mark.svg" : "/logo.svg"} alt="Kingdom Faith Based Hospital" height={height} style={{ height }} className={clsx("block w-auto max-w-none", className)} />
  );
}
