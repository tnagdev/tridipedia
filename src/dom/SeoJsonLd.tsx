import { useEffect } from 'react';
import { content, profile, skills, experience, meta } from '@/content/loadContent';

/** schema.org Person, generated from site.json so it can never drift from the page. */
export function SeoJsonLd() {
  useEffect(() => {
    const latest = experience[experience.length - 1];
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: profile.fullName ?? profile.name,
      alternateName: profile.brand,
      jobTitle: profile.designation ?? latest?.role,
      worksFor: latest ? { '@type': 'Organization', name: latest.company } : undefined,
      description: profile.bio,
      knowsAbout: skills.map((s) => s.name),
      address: { '@type': 'PostalAddress', addressCountry: profile.location },
      sameAs: socialUrls(),
      url: meta.url,
      image: meta.url + profile.avatar,
      email: content.email ? `mailto:${content.email}` : undefined,
      telephone: content.phone ?? undefined,
    };
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(ld, (_, v) => (v === undefined ? undefined : v));
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);
  return null;
}

function socialUrls(): string[] {
  return content.socials.filter((s) => s.url).map((s) => s.url!);
}
