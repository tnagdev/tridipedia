import {
  content, profile, skills, experience, projects, socials,
  yearsOfExperience, jobRangeLabel, jobDurationLabel, jobStart, jobEnd,
} from '@/content/loadContent';

/**
 * The entire site as real semantic HTML, rendered from the same site.json the
 * 3D world reads.
 *
 * This is the highest-leverage component in the project. It is simultaneously
 * the screen-reader experience, the no-WebGL fallback, the reduced-motion
 * escape hatch, the crawler-visible content, and Text Mode. Building it in
 * Phase 2 rather than last means every later 3D failure degrades to something
 * shippable instead of to a black screen.
 */
export function SiteContentDom({ variant }: { variant: 'sr' | 'visible' }) {
  const cls = variant === 'sr' ? 'sr-only' : 'textmode';
  return (
    <main className={cls} id="content">
      <header>
        <h1>
          {profile.brand}: {profile.tagline}
        </h1>
        <p>
          {profile.fullName ?? profile.name},{' '}
          {profile.designation ?? experience[experience.length - 1]?.role} at{' '}
          {experience[experience.length - 1]?.company}. Based in {profile.location}.{' '}
          {yearsOfExperience} years building for the web.
        </p>
        <p>{profile.roles.map((r) => `${r} Developer`).join(' · ')}</p>
      </header>

      <section aria-labelledby="h-about">
        <h2 id="h-about">About</h2>
        <p>{profile.bio}</p>
      </section>

      <section aria-labelledby="h-skills">
        <h2 id="h-skills">Skills</h2>
        <ul>
          {skills.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong>: {s.proficiency}% proficiency, {s.years} years
              {s.blurb ? <>. {s.blurb}</> : null}
              {s.note ? <> {s.note}</> : null}
              {s.url ? (
                <>
                  {' '}
                  <a href={s.url} rel="noopener noreferrer" target="_blank">
                    Official site
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-exp">
        <h2 id="h-exp">Experience</h2>
        {experience.map((j) => (
          <article key={j.id}>
            <h3>
              {j.role}, {j.company}
            </h3>
            <p>
              <time dateTime={jobStart(j).toISOString().slice(0, 10)}>{jobRangeLabel(j)}</time>
              {j.end === null && <span> (current)</span>} · {jobDurationLabel(j)} · {j.location}
            </p>
            {/*
              The same story the 3D flight card types out, and the same stack
              the dossier shows as chips. This section used to render a bullet
              list that existed nowhere in the 3D world, so the two modes
              described the same job differently.
            */}
            {j.story.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
            {j.tech.length > 0 && <p>Stack: {j.tech.join(', ')}</p>}
            <meta content={jobEnd(j).toISOString().slice(0, 10)} />
          </article>
        ))}
      </section>

      <section aria-labelledby="h-projects">
        <h2 id="h-projects">Projects</h2>
        {projects.every((p) => p.placeholder) ? (
          <p>Project write-ups are not published yet.</p>
        ) : null}
        <ul>
          {projects.map((p) => (
            <li key={p.id}>
              {p.url ? <a href={p.url}>{p.title}</a> : <span>{p.title}</span>}
              {p.summary ? `: ${p.summary}` : null}
              {p.tech.length > 0 && ` (${p.tech.join(', ')})`}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-contact">
        <h2 id="h-contact">Contact</h2>
        {content.email ? (
          <p>
            <a href={`mailto:${content.email}`}>{content.email}</a>
          </p>
        ) : (
          <p>Email address not published yet.</p>
        )}
        {content.phone ? (
          <p>
            <a href={`tel:${content.phone.replace(/[^+0-9]/g, '')}`}>{content.phone}</a>
          </p>
        ) : (
          <p>Phone number not published yet.</p>
        )}
        <ul>
          {socials.map((s) => (
            <li key={s.id}>
              {s.url ? (
                <a href={s.url} rel="me noopener">
                  {s.label}
                </a>
              ) : (
                <span>
                  {s.label}: not published yet
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
