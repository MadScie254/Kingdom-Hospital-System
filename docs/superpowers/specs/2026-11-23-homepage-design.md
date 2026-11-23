# Public homepage and portal entry

Date: 2026-11-23. Status: approved by the owner in chat (phone 0742007277, "the rest is default", "well detailed, best animations flow").

## Intent

Patients and families in Webuye and the region need one trustworthy page that says what Kingdom Faith Based Hospital does, where it is and how to reach it. Staff and administrators need a clear way into the portal. The old Wix site is out of date: it lists NHIF only and knows nothing of the theatre, the dental clinic or cataract surgery.

## Goals

- A public homepage at `/` that is accurate, fast on a phone with a weak connection, and looks like a serious hospital.
- Two clear sign in doors on the homepage, Hospital staff and Administrator, both ending in the portal.
- Inside the portal, the logo goes to the dashboard. A "Back to website" link goes to the homepage.
- Found by search: correct title and description, structured data for a hospital, sitemap and robots.
- Accessible: WCAG 2.2 AA, keyboard and screen reader friendly, readable at large text sizes.
- Motion that is coherent and on subject, and that stops for people who ask for reduced motion.

## Non-goals

- No booking form and no collection of patient data on the public page. No new database writes.
- No blog, CMS or second language yet.
- The Wix site is not touched. It stays up until the owner decides to redirect it.
- No prices, outcome claims, awards, testimonials or staff names. None can be verified.

## Anti-goals

- A wrong phone number, address or service. Facts come only from the owner, the old site and the public facility listings.
- Stock photos that suggest equipment the hospital does not have (the old site has a CT scanner stock photo).
- A heavy page: no large scripts, no third party embeds, no hot linked images.
- Photos that identify patients.

## Constraints

- One Cloudflare Worker, free plan: the bundle must stay under 3 MiB compressed (it is about 2.3 MiB now), and a request has about 10 ms of CPU. The page is therefore prerendered, with no per request work.
- The Content Security Policy allows only this origin. Photos and fonts are served from `public/` and the font package. The map is a link, not an embed.
- House rules: no emojis, no dashes in visible text, sentence case, Nairobi time.

## Approaches considered

1. **Build it inside this app (chosen).** One deploy, one domain, and the same login. The homepage can tell a signed in person to open the portal. Cost: a few hundred KB of photos and one font in the bundle.
2. **Rebuild on Wix through the connector.** Familiar to the owner, but a separate site cannot share the portal sign in, cannot know who is signed in, and needs a custom domain to look like one hospital.
3. **A separate static site on its own host.** Cleaner separation, but a second thing to deploy and secure, and the same login problem as Wix.

## Decisions

**Facts that appear on the page**

| Item | Value | Source |
| --- | --- | --- |
| Name | Kingdom Faith Based Hospital | owner |
| Phone | 0742 007 277 (`tel:+254742007277`) | owner, 2026-11-23 |
| Email | kingdomfaithbasedhospital@gmail.com | system settings |
| Place | Malaha Shopping Centre, off the Webuye-Kitale road, near Malaha Market, Matulo, Webuye West, Bungoma County | public facility listing, old site |
| Hours | Open 24 hours, every day | old site, facility listing |
| Insurance | SHA members welcome. Ask at reception about anything else | owner |
| Services | eye clinic, cataract surgery and optical shop, operating theatre, dental clinic, outpatient and inpatient care, chronic illness clinics, mother and child care, testing and treatment for HIV and TB, laboratory, pharmacy | owner, old site, facility listing |
| Faith line | Rooted in Christian faith, open to everyone | owner |
| Facebook | the hospital's public page | public listing |

Left out on purpose: the postal code (the old site and the system disagree), any WhatsApp number, the 2019 video, and any claim about the theatre beyond eye surgery and minor procedures.

**Look**

- Palette: ink navy `#0e2a47`, kingdom azure `#2a6fae` (the app's brand), lens blue `#8ec1ee` for accents on navy, sky wash `#eaf3fb`, chart white `#fbfdff`, signal red `#b8362b` used only for the 24 hour marker and emergency note.
- One typeface: Atkinson Hyperlegible Next, made by the Braille Institute for low vision readers. Weights 400, 600 and 800. Body 18 px on 1.6, headings tight on 1.05 to 1.15, lines under 70 characters.
- The memorable thing is the hero: a typographic eye chart on navy. Rows shrink from "Eye care" to the phone number, with the acuity labels (20/200 down to 20/20) at the row ends. A circular photo of the real eye clinic sits beside it like a lens. Everything else stays quiet: flat colour bands, thin rules, no icon grids, no card walls, no gradients.
- Photos, all the owner's own: the building, the eye clinic, eye surgery (patient draped, staff masked, flagged for the owner), a ward and the laboratory. Each is re-encoded to WebP at about 60 to 90 KB.

**Structure, top to bottom**

1. Header: logo, links to Services, Eye care, About, Insurance and Visit, a Call button, and Sign in (Hospital staff, Administrator). When signed in it shows Open portal instead.
2. Hero (the eye chart).
3. Four plain facts: open 24 hours, SHA members welcome, inpatient and outpatient, faith based and open to everyone.
4. Services as a directory in seven groups, each with a short plain description and an expandable detail.
5. Eye care: what a cataract is, signs to watch for, the usual steps, and a drag slider that shows clouded and clear vision over the real photo of the hospital.
6. About: the story from the old site, in the owner's words, tidied.
7. SHA and payment.
8. Visit us: address, how to find us, hours, call, email, directions, Facebook.
9. Two sign in doors, then the footer.

**Motion** (one easing, `cubic-bezier(.2,.7,.2,1)`, three durations: 160, 420 and 900 ms)

- Load: the chart rows come into focus one after another (blur to sharp), and the lens photo does the same once. This is the single orchestrated moment.
- Scroll: sections rise 14 px and fade in once, staggered. Nothing replays.
- Services rows tint from the left on hover and focus, and open with a smooth height change.
- The cataract slider sweeps once when it first appears to show it can be dragged, then follows the person.
- The header gains a shadow and shrinks a little after the first scroll. The active section is highlighted in the menu. The phone menu slides in.
- With `prefers-reduced-motion` all of this is off, the slider does not sweep, and every element is simply visible.

**Sign in and navigation**

- `/login?as=staff` and `/login?as=admin` share one form with a switch at the top. The admin door refuses a non administrator account: it signs the person out and says to use Hospital staff.
- `GET /api/session` returns whether the browser has a valid session cookie and the role. It reads the cookie only and touches no database.
- In the portal the sidebar logo (and so the phone menu) links to `/dashboard`. The sidebar gets a "Back to website" link, the account menu gets "Hospital website", and the dashboard header gets a "Hospital website" button.
- The logo on the sign in, request access and reset pages links to the homepage.

**Search**

- Title and description written for the people searching, Open Graph image, canonical address from `APP_ORIGIN`, `Hospital` structured data with phone, email, address and 24 hour opening hours, `sitemap.xml`, `robots.txt` that allows `/` and blocks the portal and the API. The root layout currently says `noindex`, so the homepage overrides it.

**Budget and checks**

- Page weight under 600 KB including photos and font. Largest text paints from HTML, so no image blocks it. Bundle under 3 MiB compressed, checked with a dry run deploy.
- Checked before shipping: keyboard only, 200 percent zoom, a 360 px phone, reduced motion, colour contrast, no CSP violations, and a Lighthouse style review of speed, accessibility and SEO.

## Left to the builder

Exact copy wording within the facts above, spacing and image crops, the cataract simulation filter values, and the structured data details.
