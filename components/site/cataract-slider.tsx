"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";

export type Clarity = { blur: number; sepia: number; contrast: number; brightness: number };

/**
 * How the photo looks at a slider value from 0 (most clouded) to 100 (clear).
 * A cataract blurs the picture, turns it yellow and brown, dims it and flattens the contrast, so those are the four things that move.
 * Pure, so a unit test can pin it. Input outside 0 to 100 is clamped, and a broken value shows the photo clear.
 */
export function clarity(value: number): Clarity {
  const v = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100;
  const cloud = (100 - v) / 100;
  const short = (n: number) => Math.round(n * 100) / 100;
  return {
    blur: short(9 * cloud),
    sepia: short(0.6 * cloud),
    contrast: short(1 - 0.32 * cloud),
    brightness: short(1 - 0.1 * cloud),
  };
}

function filterFor(value: number): string {
  const c = clarity(value);
  if (c.blur === 0 && c.sepia === 0 && c.contrast === 1 && c.brightness === 1) return "none";
  return `blur(${c.blur}px) sepia(${c.sepia}) contrast(${c.contrast}) brightness(${c.brightness})`;
}

/** The one sweep that shows the slider can be dragged: clear, down to 20, a short hold, back to clear. Milliseconds. */
const SWEEP = { low: 20, down: 900, hold: 280, up: 900 } as const;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function sweepValue(elapsed: number): number | null {
  const { low, down, hold, up } = SWEEP;
  if (elapsed < down) return 100 - (100 - low) * ease(elapsed / down);
  if (elapsed < down + hold) return low;
  if (elapsed < down + hold + up) return low + (100 - low) * ease((elapsed - down - hold) / up);
  return null;
}

/**
 * The real photo of the hospital, with a slider that clouds it the way a cataract does.
 * It starts clear, so with no JavaScript the photo simply shows. It sweeps once when it first scrolls into view,
 * unless the person asked for reduced motion or has already touched it. The range input does arrows, Home, End and PageUp and PageDown by itself.
 */
export function CataractSlider({ src, alt, caption, width, height }: { src: string; alt: string; caption?: string; width?: number; height?: number }) {
  const [value, setValue] = useState(100);
  const frame = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const raf = useRef(0);

  useEffect(() => {
    const el = frame.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const run = () => {
      const start = performance.now();
      const step = (now: number) => {
        if (touched.current) return;
        const v = sweepValue(now - start);
        if (v === null) {
          setValue(100);
          return;
        }
        setValue(Math.round(v));
        raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    };
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        watcher.disconnect();
        if (!touched.current) run();
      },
      { threshold: 0.6 },
    );
    watcher.observe(el);
    return () => {
      watcher.disconnect();
      cancelAnimationFrame(raf.current);
    };
  }, []);

  /** Any touch, key or drag by the person ends the sweep for good. */
  const takeOver = () => {
    touched.current = true;
    cancelAnimationFrame(raf.current);
  };

  return (
    <figure className="site-slider" onPointerDown={takeOver} onKeyDown={takeOver}>
      <div ref={frame} className="site-slider-frame" style={{ "--cloud": (100 - value) / 100 } as CSSProperties}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="site-slider-photo" src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" style={{ filter: filterFor(value) }} />
        <span className="site-slider-veil" aria-hidden="true" />
      </div>
      <input
        className="site-slider-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-label="Compare clouded and clear vision"
        aria-valuetext={`${value} percent clear`}
        onChange={(e) => {
          takeOver();
          setValue(Number(e.target.value));
        }}
      />
      <div className="site-slider-ends" aria-hidden="true">
        <span>Clouded</span>
        <span>Clear</span>
      </div>
      {caption ? <figcaption className="site-slider-caption">{caption}</figcaption> : null}
    </figure>
  );
}
