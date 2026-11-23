import type { CSSProperties } from "react";
import { HERO } from "@/lib/site-content";

/**
 * The hero. Rows of an eye chart, largest first, ending on the phone number at 20/20.
 * The first row is the page's h1 (with the hospital's name read after it for screen readers and search engines), the rest are paragraphs.
 * The acuity labels are decoration and are hidden from screen readers. Each row comes into focus in turn, set in home.css from --row.
 */
export function EyeChart() {
  return (
    <div className="chart">
      {HERO.rows.map((row, i) => {
        const style = { "--row": i } as CSSProperties;
        const inner = (
          <>
            <span className="chart-text">
              {"marker" in row && row.marker === "24h" ? <span className="mark-24" aria-hidden="true" /> : null}
              {"href" in row && row.href ? <a href={row.href}>{row.text}</a> : row.text}
              {i === 0 ? <span className="site-sr"> {HERO.titleRest}</span> : null}
            </span>
            <span className="chart-acuity" aria-hidden="true">
              {row.acuity}
            </span>
          </>
        );
        return i === 0 ? (
          <h1 key={row.acuity} className="chart-row" style={style}>
            {inner}
          </h1>
        ) : (
          <p key={row.acuity} className="chart-row" style={style}>
            {inner}
          </p>
        );
      })}
    </div>
  );
}
