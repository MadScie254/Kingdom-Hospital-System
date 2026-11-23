"use client";

import { useEffect, useRef, useState } from "react";
import { DOORS, OPEN_PORTAL, PORTAL_HOME, parseSessionAnswer, type SessionAnswer } from "@/lib/site";

let asking: Promise<SessionAnswer> | null = null;

/**
 * Asks the cookie question once however many links on the page want the answer.
 * The answer is not kept: coming back to the page after signing in or out asks again.
 * A failed or odd answer means signed out, so the doors stay available.
 */
function askSession(): Promise<SessionAnswer> {
  asking ??= fetch("/api/session", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null)
    .then(parseSessionAnswer)
    .finally(() => {
      asking = null;
    });
  return asking;
}

function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    const ask = () => {
      askSession().then((answer) => {
        if (live) setSignedIn(answer.signedIn);
      });
    };
    ask();
    // Back and forward can restore this page from memory with the answer of an earlier visit. Ask again then.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) ask();
    };
    window.addEventListener("pageshow", onShow);
    return () => {
      live = false;
      window.removeEventListener("pageshow", onShow);
    };
  }, []);
  return signedIn;
}

/** The Sign in button of the header. A native details element, so it opens with no JavaScript. Outside tap and Escape close it. */
function SignInMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const outside = (e: Event) => {
      if (box.open && !box.contains(e.target as Node)) box.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !box.open) return;
      box.open = false;
      box.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details ref={ref} className="site-signin">
      <summary className="site-btn site-btn-line">Sign in</summary>
      <ul className="site-signin-list">
        {DOORS.map((d) => (
          <li key={d.mode}>
            <a href={d.href}>
              <span className="site-door-title">{d.title}</span>
              <span className="site-door-blurb">{d.blurb}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The way into the portal, in three places. `header` is the Sign in button, `menu` is the same two doors inside the phone menu,
 * and `door` is the two large doors at the foot of the page. A visitor holding a valid session sees Open portal instead.
 * Plain links, not router links, so a public visitor never downloads the portal's code just because the link is on screen.
 */
export function PortalLink({ variant }: { variant: "header" | "menu" | "door" }) {
  const signedIn = useSignedIn();
  if (variant === "header") {
    return signedIn ? (
      <a className="site-btn site-btn-solid" href={PORTAL_HOME}>
        {OPEN_PORTAL.title}
      </a>
    ) : (
      <SignInMenu />
    );
  }
  const items = signedIn
    ? [{ key: "portal", href: PORTAL_HOME, title: OPEN_PORTAL.title, blurb: OPEN_PORTAL.blurb }]
    : DOORS.map((d) => ({ key: d.mode, href: d.href, title: d.title, blurb: d.blurb }));
  return (
    <ul className={variant === "door" ? "site-doors" : "site-menu-doors"}>
      {items.map((item) => (
        <li key={item.key}>
          <a className="site-door" href={item.href}>
            <span className="site-door-title">{item.title}</span>
            <span className="site-door-blurb">{item.blurb}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
