"use client";
import clsx from "clsx";
import type { Row } from "@/lib/seed";
import { isQuant } from "@/lib/lab";

export const FLAG_STYLE: Record<string, string> = { Normal: "b-ok", Low: "b-warn", High: "b-warn", Critical: "b-bad", Abnormal: "b-bad", "": "b-mute" };
export const FlagBadge = ({ flag }: { flag: string }) => (flag ? <span className={clsx("badge", FLAG_STYLE[flag])}>{flag}</span> : <span className="text-xs text-muted">Pending</span>);

export function RangeGauge({ test, value, width = 132 }: { test: Row; value: number | string | null; width?: number }) {
  if (!isQuant(test) || value === null || Number.isNaN(Number(value))) return null;
  const lo = test.refLow, hi = test.refHigh, span = hi - lo || 1;
  const min = lo - span * 0.7, max = hi + span * 0.7;
  const pos = (x: number) => Math.max(2, Math.min(98, ((x - min) / (max - min)) * 100));
  const v = Number(value);
  const bad = v < lo || v > hi;
  const crit = v < lo - span * 0.4 || v > hi + span * 0.6;
  return (
    <svg width={width} height="22" viewBox={`0 0 ${width} 22`} role="img" aria-label={`Result ${v} against range ${lo} to ${hi}`}>
      <rect x="0" y="9" width={width} height="4" rx="2" fill="#e8edf4" />
      <rect x={(pos(lo) / 100) * width} y="7" width={((pos(hi) - pos(lo)) / 100) * width} height="8" rx="2" fill="#cfe9d8" />
      <circle cx={(pos(v) / 100) * width} cy="11" r="5.5" fill={crit ? "#b42318" : bad ? "#a35a06" : "#15803d"} stroke="#fff" strokeWidth="1.8" />
    </svg>
  );
}

export function Trend({ points, test }: { points: number[]; test: Row }) {
  if (points.length < 2) return <span className="text-xs text-muted">First result</span>;
  const w = 96, h = 28, min = Math.min(...points, test.refLow ?? Infinity), max = Math.max(...points, test.refHigh ?? -Infinity);
  const x = (i: number) => 3 + (i / (points.length - 1)) * (w - 6), y = (v: number) => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
  return (
    <svg width={w} height={h} aria-label="Trend across previous results" role="img">
      {isQuant(test) && <rect x="0" y={y(test.refHigh)} width={w} height={Math.max(y(test.refLow) - y(test.refHigh), 1)} fill="#e3f3ea" />}
      <polyline points={points.map((p, i) => `${x(i)},${y(p)}`).join(" ")} fill="none" stroke="#1b4f9c" strokeWidth="1.6" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p)} r={i === points.length - 1 ? 3 : 1.8} fill="#1b4f9c" />)}
    </svg>
  );
}
