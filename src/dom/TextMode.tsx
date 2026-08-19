import { useEffect } from 'react';
import {
  content, profile, skills, experience, projects, socials, assetUrl, hostOf,
  yearsOfExperience, jobRangeLabel, jobDurationLabel, jobStart, jobEnd,
} from '@/content/loadContent';
import { TECH_BRAND, SOCIAL_BRAND, brandFor } from '@/text/brand';
import { PORTRAIT_ROWS, PORTRAIT_COLS } from '@/content/asciiPortrait';
import { useUi, setUi } from '@/state/store';

const KEY = 'tridipedia:textmode';

export function readStoredTextMode(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setTextMode(on: boolean) {
  setUi({ textMode: on });
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* private mode — the toggle still works for this session */
  }
}

const NAV = [
  ['about', 'About'],
  ['skills', 'Skills'],
  ['experience', 'Experience'],
  ['projects', 'Projects'],
  ['contact', 'Contact'],
] as const;

const current = experience[experience.length - 1];

/** The bio is authored as one string with blank lines between paragraphs. */
const bioParagraphs = profile.bio.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="tm-chips">
      {items.map((t) => (
        <li key={t} className="tm-chip">{t}</li>
      ))}
    </ul>
  );
}

/**
 * Text Mode: the whole site as an ordinary web page.
 *
 * Same content as the 3D world, read from the same src/data/ files and painted
 * in the same palette — but as plain semantic HTML and CSS, with no WebGL, no
 * scroll hijacking and no canvas. This is also what a no-WebGL device gets, so
 * it has to stand on its own as the site rather than as a consolation prize.
 *
 * The screen-reader mirror is a separate component (SiteContentDom); this one
 * is the visible page, so it may use the images, marks and brand colours the
 * 3D world uses and the mirror deliberately does not.
 */
export function TextMode() {
  useEffect(() => {
    document.body.classList.add('is-textmode');
    /**
     * Switching out of 3D drops the journey's tall scroll spacer, so a reader
     * who was 8000px down lands somewhere arbitrary in the middle of this page.
     * Start at the top — unless a deep link asked for a specific section.
     */
    if (!window.location.hash) window.scrollTo(0, 0);
    return () => document.body.classList.remove('is-textmode');
  }, []);

  /*
   * The portrait is the SAME hand-made block-character self-portrait the 3D
   * About section draws — src/content/asciiPortrait.ts, one source for both.
   * There a shader bakes it into a cell mask; here it is simply the text it
   * already was, which is the one place on this site where that costs nothing
   * and needs no WebGL. That last part matters: Text Mode is what a visitor
   * without WebGL is given, so it can never depend on the canvas path.
   */
  const portrait = PORTRAIT_ROWS.join('\n');

  return (
    <div className="tm">
      <header className="tm-topbar">
        <a className="tm-brand" href="#top">
          {profile.brand}<span className="tm-caret">_</span>
        </a>
        <nav aria-label="Sections">
          <ul className="tm-nav">
            {NAV.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="tm-main" id="content">
        {/* ---------- hero ---------- */}
        <section className="tm-hero" id="top">
          <p className="tm-kicker">{profile.tagline}</p>
          <h1>{profile.fullName ?? profile.name}</h1>
          <p className="tm-designation">{profile.designation ?? current.role}</p>
          {profile.title && <p className="tm-title">{profile.title}</p>}
          <ul className="tm-facts">
            <li><span>Now</span>{current.role}, {current.company}</li>
            <li><span>Based in</span>{profile.location}</li>
            <li><span>Experience</span>{yearsOfExperience} years</li>
            <li><span>Focus</span>{profile.roles.join(' · ')}</li>
          </ul>
        </section>

        {/* ---------- about ---------- */}
        <section className="tm-section" id="about" aria-labelledby="h-about">
          <h2 id="h-about"><span className="tm-num">01</span>About</h2>
          <div className="tm-about">
            <figure className="tm-avatar">
              {/*
                role="img" with a label, NOT bare text: a screen reader given
                this raw would read out two and a half thousand block
                characters. The label is what an alt attribute was doing.
                --tm-ascii-adv is the block's width in ems (columns x the
                monospace advance), which is what lets the CSS size the type
                from the column width instead of the other way round.
              */}
              <pre
                className="tm-ascii"
                role="img"
                aria-label={`Portrait of ${profile.fullName ?? profile.name}, drawn in text`}
                style={{ ['--tm-ascii-adv' as string]: PORTRAIT_COLS * 0.6 }}
              >
                {portrait}
              </pre>
              <figcaption>{profile.handle}</figcaption>
            </figure>
            <div className="tm-bio">
              {bioParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
          {/* The 3D About card's current-role tile — the only place `blurb` renders. */}
          <div className="tm-card tm-current">
            <p className="tm-meta">Currently</p>
            <h3>{current.role}<em>{current.company}</em></h3>
            <p className="tm-meta">{jobRangeLabel(current)} · {current.location}</p>
            <p>{current.blurb ?? current.tech.join(' · ')}</p>
          </div>
        </section>

        {/* ---------- skills ---------- */}
        <section className="tm-section" id="skills" aria-labelledby="h-skills">
          <h2 id="h-skills"><span className="tm-num">02</span>Skills</h2>
          <ul className="tm-grid tm-skills">
            {skills.map((s) => {
              const brand = brandFor(TECH_BRAND, s.id);
              const icon = assetUrl(s.icon);
              return (
                <li key={s.id} className="tm-card">
                  <div className="tm-card-head">
                    {icon && (
                      <img className="tm-mark" src={icon} alt="" aria-hidden="true" loading="lazy" />
                    )}
                    <h3 style={{ color: brand.color }}>{s.name}</h3>
                    <span className="tm-tag">{s.years} yr{s.years === 1 ? '' : 's'}</span>
                  </div>
                  <div
                    className="tm-meter"
                    role="img"
                    aria-label={`${s.proficiency} percent proficiency`}
                  >
                    <span style={{ width: `${s.proficiency}%`, background: brand.color }} />
                    <b>{s.proficiency}%</b>
                  </div>
                  {s.blurb && <p>{s.blurb}</p>}
                  {s.note && <p className="tm-note">{s.note}</p>}
                  {s.url && (
                    <a className="tm-link" href={s.url} rel="noopener noreferrer" target="_blank">
                      Official site →
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---------- experience ---------- */}
        <section className="tm-section" id="experience" aria-labelledby="h-exp">
          <h2 id="h-exp"><span className="tm-num">03</span>Experience</h2>
          <ol className="tm-timeline">
            {experience.map((j) => {
              const logo = assetUrl(j.logo);
              return (
                <li key={j.id} className="tm-card">
                  <div className="tm-card-head">
                    {logo && (
                      <img className="tm-mark" src={logo} alt="" aria-hidden="true" loading="lazy" />
                    )}
                    <h3>
                      {j.role}
                      <em>
                        {j.url ? (
                          <a href={j.url} rel="noopener noreferrer" target="_blank">{j.company}</a>
                        ) : (
                          j.company
                        )}
                      </em>
                    </h3>
                    {j.end === null && <span className="tm-tag is-live">Current</span>}
                  </div>
                  <p className="tm-meta">
                    <time dateTime={jobStart(j).toISOString().slice(0, 10)}>{jobRangeLabel(j)}</time>
                    {' · '}{jobDurationLabel(j)}{' · '}{j.location}
                  </p>
                  {j.story.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                  {j.tech.length > 0 && <Chips items={j.tech} />}
                  <meta content={jobEnd(j).toISOString().slice(0, 10)} />
                </li>
              );
            })}
          </ol>
        </section>

        {/* ---------- projects ---------- */}
        <section className="tm-section" id="projects" aria-labelledby="h-projects">
          <h2 id="h-projects"><span className="tm-num">04</span>Projects</h2>
          {projects.every((p) => p.placeholder) && (
            <p className="tm-note">Project write-ups are not published yet.</p>
          )}
          <ul className="tm-grid tm-projects">
            {projects.map((p) => {
              const thumb = assetUrl(p.thumbnail);
              return (
                <li key={p.id} className="tm-card">
                  {thumb && (
                    <img
                      className="tm-thumb"
                      src={thumb}
                      alt={`${p.title} screenshot`}
                      loading="lazy"
                    />
                  )}
                  {/* The link sits beside the name, as it does in the 3D
                      dossier, and prints the same host string. */}
                  <div className="tm-card-head is-project">
                    <h3>{p.title}</h3>
                    {p.url && (
                      <a className="tm-link" href={p.url} rel="noopener noreferrer" target="_blank">
                        {hostOf(p.url)} ↗
                      </a>
                    )}
                    {p.repo && (
                      <a className="tm-link" href={p.repo} rel="noopener noreferrer" target="_blank">
                        Source ↗
                      </a>
                    )}
                    {p.year && <span className="tm-tag">{p.year}</span>}
                  </div>
                  {p.role && <p className="tm-meta">{p.role}</p>}
                  {p.summary && <p className="tm-lead">{p.summary}</p>}
                  {p.details && <p>{p.details}</p>}
                  {p.tech.length > 0 && <Chips items={p.tech} />}
                  {p.placeholder && <p className="tm-note">Write-up not published yet.</p>}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---------- contact ---------- */}
        <section className="tm-section" id="contact" aria-labelledby="h-contact">
          <h2 id="h-contact"><span className="tm-num">05</span>Contact</h2>
          <ul className="tm-contact">
            <li>
              <span>Email</span>
              {content.email ? (
                <a href={`mailto:${content.email}`}>{content.email}</a>
              ) : (
                <em>Not published yet.</em>
              )}
            </li>
            <li>
              <span>Phone</span>
              {content.phone ? (
                <a href={`tel:${content.phone.replace(/[^+0-9]/g, '')}`}>{content.phone}</a>
              ) : (
                <em>Not published yet.</em>
              )}
            </li>
          </ul>
          <ul className="tm-socials">
            {socials.map((s) => {
              const brand = brandFor(SOCIAL_BRAND, s.id);
              const icon = assetUrl(s.icon);
              const inner = (
                <>
                  {icon && (
                    <img className="tm-mark" src={icon} alt="" aria-hidden="true" loading="lazy" />
                  )}
                  <span className="tm-social-label" style={{ color: brand.color }}>{s.label}</span>
                  <span className="tm-social-handle">
                    {s.url ? s.handle : 'not published yet'}
                  </span>
                </>
              );
              return (
                <li key={s.id}>
                  {s.url ? (
                    <a className="tm-social" href={s.url} rel="me noopener noreferrer" target="_blank">
                      {inner}
                    </a>
                  ) : (
                    <span className="tm-social">{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="tm-foot">
        <p>
          {profile.brand} — {profile.tagline}. You are reading the text version; the
          same content is also a 3D journey.
        </p>
      </footer>
    </div>
  );
}

/** The toggle. A real button, always reachable, first in the tab order after skip. */
export function TextModeToggle() {
  const on = useUi((s) => s.textMode);
  const failed = useUi((s) => s.webglFailed);
  if (failed) return null; // no point offering a 3D mode that cannot run
  return (
    <button
      type="button"
      className="mode-toggle"
      aria-pressed={on}
      onClick={() => setTextMode(!on)}
      title={on ? 'Return to the 3D experience' : 'Read this site as plain text'}
    >
      {on ? '◈ 3D MODE' : '⌨ TEXT MODE'}
    </button>
  );
}
