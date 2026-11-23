import { Fragment } from "react";
import { SITE } from "@/lib/site";

/** Running text that may hold the hospital's number. The number stays on one line, so nobody reads "0742" at the end of one line and "007 277" at the start of the next. */
export function Text({ children }: { children: string }) {
  const parts = children.split(SITE.phoneDisplay);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="nowrap">{SITE.phoneDisplay}</span> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}
