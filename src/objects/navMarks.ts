/**
 * Navigation marks as inline SVG.
 *
 * Same approach as socialMarks.ts: authored here as SVG source strings and
 * rasterised through the shared mark atlas, so the nav rail gains icons without
 * a single binary asset entering the repo and without a runtime fetch.
 *
 * Drawn as white silhouettes — colour is applied per instance in the rail's
 * shader, which is what lets one atlas serve the idle, hovered and active
 * states of every item.
 */

/** Prefixed so nav ids can never collide with a tech or social mark id. */
export function navMarkId(sectionId: string): string {
  return `nav-${sectionId}`;
}

/** viewBox normalised to 0 0 24 24 for every mark, matching the other mark sets. */
export const NAV_SVG: Record<string, string> = {
  // home — the boot screen
  'nav-hero': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M12 2.6 1.5 11.2l1.5 1.85L4 12.2V21a1 1 0 0 0 1 1h5v-6h4v6h5a1 1 0 0 0 1-1v-8.8l1 .85 1.5-1.85L12 2.6Z"/></svg>`,

  // a person — the profile
  'nav-about': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M12 12.4a4.7 4.7 0 1 0 0-9.4 4.7 4.7 0 0 0 0 9.4Zm0 1.9c-4.6 0-8.3 2.7-8.3 6V22h16.6v-1.7c0-3.3-3.7-6-8.3-6Z"/></svg>`,

  // stacked layers — the stack
  'nav-skills': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M12 2 1 8l11 6 11-6-11-6Zm0 13.9L3.3 11 1 12.25l11 6 11-6L20.7 11 12 15.9Zm0 4L3.3 15 1 16.25l11 6 11-6L20.7 15 12 19.9Z"/></svg>`,

  // briefcase — the work history
  'nav-experience': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M9 3h6a2 2 0 0 1 2 2v2h3.2A1.8 1.8 0 0 1 22 8.8v10.4a1.8 1.8 0 0 1-1.8 1.8H3.8A1.8 1.8 0 0 1 2 19.2V8.8A1.8 1.8 0 0 1 3.8 7H7V5a2 2 0 0 1 2-2Zm0 4h6V5H9v2Zm-5 5.4h6.4v2.2h3.2v-2.2H20v-2H4v2Z"/></svg>`,

  // a grid of frames — the project wall
  'nav-projects': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M2.5 2.5h8.2v8.2H2.5V2.5Zm10.8 0h8.2v8.2h-8.2V2.5ZM2.5 13.3h8.2v8.2H2.5v-8.2Zm10.8 0h8.2v8.2h-8.2v-8.2Z"/></svg>`,



  // envelope — the way out
  'nav-contact': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M2 4h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm10 8.13L3.6 6H20.4L12 12.13ZM3 8.24V18h18V8.24l-8.4 6.13a1 1 0 0 1-1.2 0L3 8.24Z"/></svg>`,
};

/** Data URL for a nav mark, ready for `new Image().src`. No network access involved. */
export function navSvgDataUrl(id: string): string | null {
  const svg = NAV_SVG[id];
  if (!svg) return null;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
