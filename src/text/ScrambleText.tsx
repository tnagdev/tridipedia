import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TerminalText } from './TerminalText';
import { GLYPHS } from '@/rain/glyphAtlas';

const POOL = GLYPHS.filter((g) => /[A-Z0-9<>|=+\-*:.]/.test(g));
const pick = (seed: number) => POOL[Math.floor(Math.abs(Math.sin(seed) * 9973)) % POOL.length];

interface Props {
  words: string[];
  suffix?: string;
  interval?: number;
  [key: string]: unknown;
}

/**
 * The role rotator, decrypt-style.
 *
 * Mutates text through a ref rather than React state. Note that changing a
 * troika string DOES re-run layout, so this is deliberately throttled to a
 * fixed tick rate rather than updating every frame.
 */
export function ScrambleText({ words, suffix = '', interval = 2.6, ...rest }: Props) {
  const ref = useRef<{ text: string } | null>(null);
  const state = useRef({ i: 0, t: 0, last: '' });

  useFrame((_, delta) => {
    const s = state.current;
    s.t += delta;

    const cycle = s.t % interval;
    const word = words[s.i % words.length];
    let out: string;

    if (cycle < 0.55) {
      // decrypt: reveal left-to-right, scramble the rest
      const revealed = Math.floor((cycle / 0.55) * word.length);
      out = word
        .split('')
        .map((c, idx) => (idx < revealed ? c : pick(s.t * 60 + idx)))
        .join('');
    } else {
      out = word;
    }

    if (s.t > interval * (s.i + 1)) s.i++;

    const next = out + suffix;
    // Guard: only touch troika when the string actually changed, or every
    // frame would re-run text layout.
    if (next !== s.last && ref.current) {
      ref.current.text = next;
      s.last = next;
    }
  });

  return (
    <TerminalText ref={ref as never} {...rest}>
      {words[0] + suffix}
    </TerminalText>
  );
}
