import { FALLS_CREDIT, SITE } from "@/lib/site";
import { ABOUT, CATARACT, COPY, EYE_URGENT, FACTS, HERO, PHOTOS, SHA_COPY, VISIT, VISIT_FLOW } from "@/lib/site-content";
import { CataractSlider } from "./cataract-slider";
import { EyeChart } from "./eye-chart";
import { Pic } from "./pic";
import { PortalLink } from "./portal-link";
import { Reveal } from "./reveal";
import { Services } from "./services";
import { SiteHeader } from "./site-header";
import { Text } from "./text";

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * The public homepage, top to bottom: header, the eye chart, four plain facts, services, eye care, about, insurance, visit us,
 * the two sign in doors and the footer. A server component with no per request work, so it prerenders. The interactive parts
 * (header, slider, reveal, sign in links) are the client components from the same folder. `app/page.tsx` adds the stylesheet and the metadata.
 */
export function HomePage() {
  return (
    <div className="home">
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <section className="band band-ink hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <EyeChart />
              <p className="hero-lead">{HERO.lead}</p>
              <p className="hero-place">{HERO.place}</p>
              <div className="hero-actions">
                <a className="cta cta-light" href={`tel:${SITE.phoneTel}`}>
                  {HERO.call}
                </a>
                <a className="cta cta-ghost" href={SITE.mapsUrl} {...EXTERNAL}>
                  {HERO.directions}
                </a>
              </div>
            </div>
            <figure className="hero-lens">
              <Pic photo={PHOTOS["eye-clinic"]} className="lens-photo" priority />
            </figure>
          </div>
        </section>

        <section className="band band-wash facts" aria-label={COPY.facts.label}>
          <ul className="wrap facts-list">
            {FACTS.map((fact, i) => (
              <Reveal as="li" key={fact.title} className="fact" delay={i * 80}>
                <p className="fact-title">{fact.title}</p>
                <p className="fact-text">
                  <Text>{fact.text}</Text>
                </p>
              </Reveal>
            ))}
          </ul>
        </section>

        <section id="services" className="band services" aria-labelledby="services-title">
          <div className="wrap">
            <Reveal className="section-head">
              <h2 id="services-title">{COPY.services.title}</h2>
              <p className="intro">{COPY.services.intro}</p>
            </Reveal>
            <Reveal>
              <Services />
            </Reveal>
          </div>
        </section>

        <section id="eye-care" className="band band-wash eye" aria-labelledby="eye-title">
          <div className="wrap eye-grid">
            <div className="eye-main">
              <Reveal className="eye-text">
                <div>
                  <h2 id="eye-title">{COPY.eye.title}</h2>
                  <p className="intro">{COPY.eye.intro}</p>
                </div>
                <p>{CATARACT.what}</p>
                <div>
                  <h3>{COPY.eye.signsTitle}</h3>
                  <ul className="signs">
                    {CATARACT.signs.map((sign) => (
                      <li key={sign}>{sign}</li>
                    ))}
                  </ul>
                </div>
                <p className="note">{CATARACT.note}</p>
                <p className="urgent">
                  <Text>{EYE_URGENT}</Text>
                </p>
              </Reveal>
              <Reveal className="eye-steps">
                <h3>{COPY.eye.stepsTitle}</h3>
                <ol className="steps">
                  {CATARACT.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </Reveal>
            </div>
            <div className="eye-side">
              <Reveal className="eye-slider">
                <CataractSlider
                  src={PHOTOS.building.src}
                  alt={PHOTOS.building.alt}
                  width={PHOTOS.building.width}
                  height={PHOTOS.building.height}
                  caption={COPY.eye.sliderCaption}
                />
              </Reveal>
              <Reveal as="figure" className="eye-surgery">
                <Pic photo={PHOTOS["eye-surgery"]} />
                <figcaption>{COPY.eye.surgeryCaption}</figcaption>
              </Reveal>
            </div>
          </div>
        </section>

        <section id="about" className="band about" aria-labelledby="about-title">
          <div className="wrap about-grid">
            <Reveal className="about-text">
              <h2 id="about-title">{COPY.about.title}</h2>
              {ABOUT.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </Reveal>
            <Reveal as="figure" className="about-building about-figure">
              <Pic photo={PHOTOS.building} />
              <figcaption>{COPY.about.buildingCaption}</figcaption>
            </Reveal>
            <Reveal className="about-flow">
              <h3>{COPY.about.flowTitle}</h3>
              <ol className="steps">
                {VISIT_FLOW.map((step) => (
                  <li key={step.title}>
                    <span className="flow-title">{step.title}</span>
                    {step.text}
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal as="figure" className="about-falls about-figure">
              <Pic photo={PHOTOS["webuye-falls"]} />
              <figcaption>{COPY.about.fallsCaption}</figcaption>
            </Reveal>
          </div>
        </section>

        <section id="insurance" className="band band-wash insurance" aria-labelledby="insurance-title">
          <div className="wrap insurance-grid">
            <Reveal>
              <h2 id="insurance-title">{COPY.insurance.title}</h2>
            </Reveal>
            <Reveal className="insurance-copy">
              {SHA_COPY.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </Reveal>
          </div>
        </section>

        <section id="visit" className="band band-ink visit" aria-labelledby="visit-title">
          <div className="wrap visit-grid">
            <Reveal className="visit-main">
              <h2 id="visit-title">{COPY.visit.title}</h2>
              <dl className="visit-list">
                <div>
                  <dt>{COPY.visit.addressLabel}</dt>
                  <dd>
                    {SITE.address.line}, {SITE.address.locality}, {SITE.address.area}, {SITE.address.region}
                  </dd>
                </div>
                <div>
                  <dt>{COPY.visit.hoursLabel}</dt>
                  <dd>
                    <span className="mark-24" aria-hidden="true" />
                    {SITE.hours}
                  </dd>
                </div>
                <div>
                  <dt>{COPY.visit.callLabel}</dt>
                  <dd>
                    <a href={`tel:${SITE.phoneTel}`}>{SITE.phoneDisplay}</a>
                  </dd>
                </div>
                <div>
                  <dt>{COPY.visit.emailLabel}</dt>
                  <dd>
                    <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
                  </dd>
                </div>
                <div>
                  <dt>{COPY.visit.facebookLabel}</dt>
                  <dd>
                    <a href={SITE.facebook} {...EXTERNAL}>
                      {COPY.visit.facebookText}
                    </a>
                  </dd>
                </div>
              </dl>
            </Reveal>
            <Reveal className="visit-find">
              <h3>{COPY.visit.findTitle}</h3>
              {VISIT.how.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <a className="cta cta-light" href={SITE.mapsUrl} {...EXTERNAL}>
                {HERO.directions}
              </a>
              <p className="emergency">
                <span className="mark-24" aria-hidden="true" />
                <Text>{VISIT.note}</Text>
              </p>
            </Reveal>
          </div>
        </section>

        <section id="signin" className="band band-wash doors" aria-labelledby="signin-title">
          <div className="wrap doors-list">
            <Reveal className="section-head">
              <h2 id="signin-title">{COPY.doors.title}</h2>
              <p className="intro">{COPY.doors.intro}</p>
            </Reveal>
            <Reveal>
              <PortalLink variant="door" />
              <p className="doors-request">
                <a href="/signup">{COPY.doors.request}</a>
              </p>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-grid">
          <div>
            <p className="footer-name">{SITE.name}</p>
            <p>{COPY.footer.tagline}</p>
            <p>
              <a href="/login">{COPY.footer.portal}</a>
            </p>
          </div>
          <address>
            <span>{SITE.address.line}</span>
            <span>
              {SITE.address.locality}, {SITE.address.area}, {SITE.address.region}
            </span>
            <a href={`tel:${SITE.phoneTel}`}>{SITE.phoneDisplay}</a>
            <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </address>
          <div className="credits">
            <p>{COPY.footer.photos}</p>
            <p>
              Photo of {FALLS_CREDIT.title} by {FALLS_CREDIT.author},{" "}
              <a href={FALLS_CREDIT.licenseUrl} {...EXTERNAL}>
                {FALLS_CREDIT.license}
              </a>
              , via{" "}
              <a href={FALLS_CREDIT.sourceUrl} {...EXTERNAL}>
                Wikimedia Commons
              </a>
              . {FALLS_CREDIT.change}.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
