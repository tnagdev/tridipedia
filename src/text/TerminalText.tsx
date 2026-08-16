import { Text } from '@react-three/drei';
import { forwardRef } from 'react';
import type * as THREE from 'three';
import { PALETTE } from './palette';

export const UI_FONT = undefined; // system monospace via troika default; see preloadFonts

type TextProps = React.ComponentProps<typeof Text>;

/**
 * All readable copy goes through here.
 *
 * The black outline is the single biggest readability win against animated
 * green-on-green rain: troika renders it in its own shader for free, and it
 * works against ANY background, unlike a backing plane which only works where
 * you remembered to put one.
 */
export const TerminalText = forwardRef<never, TextProps>(function TerminalText(props, ref) {
  return (
    <Text
      ref={ref as never}
      color={PALETTE.text}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.018}
      outlineColor={PALETTE.outline}
      outlineOpacity={0.9}
      letterSpacing={0.04}
      material-toneMapped={false}
      material-depthWrite={false}
      material-transparent={true}
      {...props}
    />
  );
});

/**
 * The troika instance behind drei's <Text>. Exposes the properties that can be
 * mutated per-frame WITHOUT triggering a text re-layout — unlike `text`, which
 * re-runs layout and must never be set every frame.
 */
export interface TroikaText extends THREE.Mesh {
  text: string;
  fillOpacity: number;
  outlineOpacity: number;
  clipRect: [number, number, number, number] | null;
}
