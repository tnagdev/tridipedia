/// <reference types="vite/client" />

declare module '*.glsl?raw' {
  const src: string;
  export default src;
}

/** UI icons are pulled from lucide-static as SVG source and rasterised into the
 *  shared mark atlas — see src/objects/iconMarks.ts. */
declare module '*.svg?raw' {
  const src: string;
  export default src;
}

declare module 'troika-three-text' {
  export function preloadFont(
    options: { font?: string; characters?: string | string[]; sdfGlyphSize?: number },
    callback: () => void,
  ): void;
}
