/// <reference types="vite/client" />

declare module '*.glsl?raw' {
  const src: string;
  export default src;
}

declare module 'troika-three-text' {
  export function preloadFont(
    options: { font?: string; characters?: string | string[]; sdfGlyphSize?: number },
    callback: () => void,
  ): void;
}
