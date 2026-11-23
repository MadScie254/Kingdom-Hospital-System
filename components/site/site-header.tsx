"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { NAV, SITE } from "@/lib/site";
import { PortalLink } from "./portal-link";

/** From this width the section links sit in the header bar. Below it they live in a slide in menu. `home.css` uses the same number, in rem so a larger default text size switches to the menu earlier (57.5rem is 920 px at the default size). */
const WIDE = "(min-width: 57.5rem)";

const FOCUSABLE = 'a[href], button:not([disabled]), summary, input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Logo, section links, Call and Sign in. A shadow and a smaller bar after the first 8 px of scroll, the section being read is marked,
 * and below 57.5rem the links open in a slide in menu that traps focus, closes on Escape, a link tap or the backdrop, and holds the page still.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const closeAndReturn = () => {
    setOpen(false);
    burger.current?.focus();
  };

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Mark the section that is crossing a thin band a little above the middle of the screen.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = NAV.map((n) => document.getElementById(n.id)).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const inBand = new Map<string, boolean>();
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) inBand.set(entry.target.id, entry.isIntersecting);
        setActive(NAV.find((n) => inBand.get(n.id))?.id ?? null);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    for (const el of sections) watcher.observe(el);
    return () => watcher.disconnect();
  }, []);

  // A menu left open on a phone must not stay open when the window grows into the wide layout.
  useEffect(() => {
    const wide = window.matchMedia(WIDE);
    const onChange = () => {
      if (wide.matches) setOpen(false);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  // While the menu is open: focus moves in, Tab stays in, Escape closes, and the page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    const box = panel.current;
    if (!box) return;
    const items = () => Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    items()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        burger.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || !box.contains(at))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !box.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = before;
    };
  }, [open]);

  return (
    <header className={clsx("site-header", scrolled && "is-scrolled")}>
      <a className="site-skip" href="#main">
        Skip to main content
      </a>
      <div className="site-bar">
        <a className="site-logo" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Kingdom Faith Based Hospital" width={117} height={46} />
        </a>

        {open ? <div className="site-backdrop" aria-hidden="true" onClick={closeAndReturn} /> : null}
        <div
          id="site-menu"
          ref={panel}
          className={clsx("site-menu", open && "is-open")}
          role={open ? "dialog" : undefined}
          aria-modal={open ? true : undefined}
          aria-label={open ? "Menu" : undefined}
        >
          <button type="button" className="site-menu-close" aria-label="Close menu" onClick={closeAndReturn}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
              <path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <nav aria-label="Main">
            <ul className="site-nav">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a href={`#${n.id}`} aria-current={active === n.id ? "location" : undefined} onClick={() => setOpen(false)}>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <PortalLink variant="menu" />
          <a className="site-call site-menu-call" href={`tel:${SITE.phoneTel}`}>
            <span className="site-call-label">Call</span> <span>{SITE.phoneDisplay}</span>
          </a>
        </div>

        <div className="site-actions">
          <a className="site-call" href={`tel:${SITE.phoneTel}`}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <path
                d="M6.6 3.5h2.7l1.4 4-1.8 1.4a11 11 0 0 0 5.2 5.2l1.4-1.8 4 1.4v2.7a2 2 0 0 1-2.1 2A15.5 15.5 0 0 1 4.6 5.6a2 2 0 0 1 2-2.1z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            <span className="site-call-label">Call</span> <span className="site-call-number">{SITE.phoneDisplay}</span>
          </a>
          <PortalLink variant="header" />
          <button
            type="button"
            ref={burger}
            className="site-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
