import { useMemo } from 'react';
import { SECTIONS } from '@/state/sections';
import { scrollToProgress } from '@/scroll/ScrollProvider';
import { skills, experience, projects, socials } from '@/content/loadContent';
import { setUi } from '@/state/store';

interface Target {
  id: string;
  label: string;
  href?: string;
  progress: number;
}

/**
 * Keyboard and screen-reader access to everything that is only "in" the WebGL
 * scene. This is the half of interaction that raycasting genuinely cannot
 * provide — and, crucially, it needs NO per-frame position syncing, which is
 * why the abeto proxy-div approach is unnecessary here.
 *
 * Focusing a target flies the camera to it AND sets the same hover state the
 * raycaster sets, so keyboard users get identical visual feedback.
 */
export function A11yLayer() {
  const targets = useMemo<Target[]>(() => {
    const at = (id: string) => SECTIONS.find((s) => s.id === id)!.range;
    const spread = (id: string, i: number, n: number) => {
      const [a, b] = at(id);
      return a + ((i + 0.5) / n) * (b - a);
    };
    return [
      ...skills.map((s, i) => ({
        id: `skill:${s.id}`,
        label: `${s.name} — ${s.proficiency}% proficiency, ${s.years} years`,
        progress: spread('skills', i, skills.length),
      })),
      ...experience.map((j, i) => ({
        id: `job:${j.id}`,
        label: `${j.role} at ${j.company}`,
        progress: spread('experience', i, experience.length),
      })),
      ...projects.map((p, i) => ({
        id: `project:${p.id}`,
        label: p.placeholder ? `${p.title} — not published yet` : p.title,
        href: p.url ?? undefined,
        progress: spread('projects', i, projects.length),
      })),
      ...socials.map((s, i) => ({
        id: `social:${s.id}`,
        label: s.url ? `${s.label} profile` : `${s.label} — not published yet`,
        href: s.url ?? undefined,
        progress: spread('contact', i, socials.length),
      })),
    ];
  }, []);

  return (
    <div className="a11y-layer" aria-label="Scene navigation">
      {targets.map((t) => (
        <a
          key={t.id}
          href={t.href ?? `#${t.id}`}
          data-hotspot={t.id}
          onFocus={() => {
            setUi({ hovered: t.id });
            scrollToProgress(t.progress, { duration: 1.4 });
          }}
          onBlur={() => setUi({ hovered: null })}
          onClick={(e) => {
            if (!t.href) e.preventDefault();
          }}
          {...(t.href ? { target: '_blank', rel: 'noopener' } : {})}
        >
          {t.label}
        </a>
      ))}
    </div>
  );
}
