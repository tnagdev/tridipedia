/**
 * Panel-local layout.
 *
 * Everything in this site was previously positioned with hand-tuned world
 * coordinates — a title at [-5.1, 2.72, 0.05] beside a panel at [0, 0, -0.12].
 * Change the panel size and every child has to be re-tuned by eye, which is
 * exactly how text ended up overflowing panels and colliding with the nav.
 *
 * This computes child positions FROM the panel's own dimensions, in the
 * panel's local space, so a panel and its contents can never disagree. Put the
 * children in a <group> at the panel's position and use these offsets.
 *
 * Coordinate space: origin at panel centre, +x right, +y up, matching how a
 * PlaneGeometry of (width, height) is laid out.
 */

export interface PanelMetrics {
  width: number;
  height: number;
  /** Header band height as a fraction of panel height (0 = no header). */
  header: number;
  /** Inner padding as a fraction of the SHORTER side, so it stays proportional. */
  padding: number;
}

export interface PanelBox {
  /** Content area, excluding header, footer and padding. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  /** Baseline for the header title. */
  headerY: number;
  /** Y of the rule under the header. */
  headerRuleY: number;
  /** Y of the footer status strip. */
  footerY: number;
  /** Convenience: a comfortable body font size for this panel. */
  bodySize: number;
  titleSize: number;
  captionSize: number;
  lineHeight: number;
}

const DEFAULTS = { header: 0.14, padding: 0.055, footer: 0.09 };

export function panelBox(m: Partial<PanelMetrics> & { width: number; height: number }): PanelBox {
  const width = m.width;
  const height = m.height;
  const header = m.header ?? DEFAULTS.header;
  const padFrac = m.padding ?? DEFAULTS.padding;

  const pad = Math.min(width, height) * padFrac;
  const halfW = width / 2;
  const halfH = height / 2;

  const headerH = header * height;
  const footerH = header > 0 ? DEFAULTS.footer * height : 0;

  const top = halfH - headerH - pad * 0.4;
  const bottom = -halfH + footerH + pad * 0.4;
  const left = -halfW + pad;
  const right = halfW - pad;

  // Type scale derives from panel height so a small panel gets small type and
  // a large one gets large type, without any per-call tuning.
  const bodySize = Math.max(0.16, height * 0.052);

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: top - bottom,
    headerY: halfH - headerH * 0.5,
    headerRuleY: halfH - headerH,
    footerY: -halfH + footerH * 0.55,
    bodySize,
    titleSize: bodySize * 1.22,
    captionSize: bodySize * 0.78,
    lineHeight: 1.5,
  };
}

/** Evenly spaced X positions across the content box, for chips or columns. */
export function columns(box: PanelBox, count: number, gutter = 0.3): number[] {
  if (count <= 0) return [];
  const total = box.width - gutter * (count - 1);
  const w = total / count;
  return Array.from({ length: count }, (_, i) => box.left + w / 2 + i * (w + gutter));
}

/** Y positions for `count` stacked rows starting at the top of the content box. */
export function rows(box: PanelBox, count: number, size = box.bodySize): number[] {
  const step = size * box.lineHeight;
  return Array.from({ length: count }, (_, i) => box.top - size * 0.5 - i * step);
}

/**
 * Longest line length in a block of text, used to pick a panel width that
 * actually fits its content instead of guessing.
 */
export function widestLine(lines: string[]): number {
  return lines.reduce((n, l) => Math.max(n, l.length), 0);
}

/**
 * Panel width needed to hold `chars` monospace-ish characters at `size`.
 * Troika's default font is proportional, so 0.55 is an empirical average
 * advance ratio — deliberately generous, because overflowing a panel looks far
 * worse than a little slack.
 */
export function widthForChars(chars: number, size: number, padding = DEFAULTS.padding): number {
  const content = chars * size * 0.55;
  return content / (1 - padding * 2);
}
