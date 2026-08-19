import { useEffect, useState } from 'react';
import { F } from '@/state/frameState';
import { isWithin, onSectionChange } from '@/state/sections';
import type { SectionId } from '@/content/content.types';

/**
 * Mount gating — the one place a per-scroll setState is allowed, because it
 * fires at most ~12 times across a whole journey.
 */
export function useSectionActive(id: SectionId, pad = 0.06) {
  const [active, setActive] = useState(() => isWithin(id, F.smooth, pad));
  useEffect(
    () =>
      onSectionChange(() => {
        const next = isWithin(id, F.smooth, pad);
        setActive((prev) => (prev === next ? prev : next)); // identity guard
      }),
    [id, pad],
  );
  return active;
}
