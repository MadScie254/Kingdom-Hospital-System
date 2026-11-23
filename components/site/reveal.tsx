"use client";

import clsx from "clsx";
import { type CSSProperties, type ElementType, type ReactNode, useEffect, useRef } from "react";

/** One observer for every reveal on the page. Each element is shown once and then let go. */
let watcher: IntersectionObserver | null = null;
const waiting = new Map<Element, () => void>();

function wait(el: Element, show: () => void) {
  watcher ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const show = waiting.get(entry.target);
        waiting.delete(entry.target);
        watcher?.unobserve(entry.target);
        show?.();
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  waiting.set(el, show);
  watcher.observe(el);
}

function forget(el: Element) {
  waiting.delete(el);
  watcher?.unobserve(el);
}

/**
 * Rises 14 px and fades in once, the first time it scrolls into view.
 * The server HTML carries no hidden state at all. The stylesheet only starts hiding `.site-reveal` once the `js` class is on the page,
 * and this effect adds `is-in` to everything already on screen before it adds `js`, so nothing visible flickers and nothing stays hidden if scripts fail.
 */
export function Reveal({ as, delay = 0, className, children }: { as?: ElementType; delay?: number; className?: string; children?: ReactNode }) {
  const Tag: ElementType = as ?? "div";
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.classList.add("is-in");
    if (typeof IntersectionObserver === "undefined" || el.getBoundingClientRect().top < window.innerHeight * 0.92) show();
    else wait(el, show);
    document.documentElement.classList.add("js");
    return () => forget(el);
  }, []);

  return (
    <Tag ref={ref} className={clsx("site-reveal", className)} style={delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined}>
      {children}
    </Tag>
  );
}
