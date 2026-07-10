import { bench, describe } from 'vitest';
import { beliefLens, contradictionLens } from '../../src/client/modulation/compile.js';
import { evaluate } from '../../src/client/modulation/evaluate.js';
import { createMemoCache, getMemoCache, resetMemoCache } from '../../src/client/modulation/memo.js';
import { evaluateModulation } from '../../src/client/modulation/operators.js';
import type { Item, Lens, View } from '../../src/client/modulation/types.js';

function makeItems(n: number): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < n; i++) {
    items.push({
      id: `node-${i}`,
      priority: Math.random(),
      confidence: Math.random(),
      nodeType: 'concept',
      isContradiction: i % 10 === 0,
      truth: { frequency: Math.random(), confidence: Math.random() },
    });
  }
  return items;
}

const view: View = {
  flags: { reducedMotion: false, highContrast: false, prefersColorScheme: 'dark' },
  timeline: { t: Number.POSITIVE_INFINITY },
};

const beliefLensObj: Lens = {
  id: 'belief',
  label: 'Belief',
  description: 'Color by truth frequency, opacity by confidence',
  modulation: beliefLens(),
};

const contradictionLensObj: Lens = {
  id: 'contradiction',
  label: 'Contradiction',
  description: 'Highlight contradictions',
  modulation: contradictionLens(),
};

describe('modulation engine', () => {
  describe('evaluateModulation single item', () => {
    const item = makeItems(1)[0] as Item;

    bench('belief lens', () => {
      evaluateModulation(beliefLensObj.modulation, item, view);
    });

    bench('contradiction lens (non-contradiction)', () => {
      evaluateModulation(
        contradictionLensObj.modulation,
        { ...item, isContradiction: false },
        view
      );
    });

    bench('contradiction lens (contradiction)', () => {
      evaluateModulation(contradictionLensObj.modulation, { ...item, isContradiction: true }, view);
    });
  });

  describe('evaluate 1k items', () => {
    const items = makeItems(1000);

    bench('belief lens', () => {
      resetMemoCache();
      evaluate(items, beliefLensObj, view);
    });

    bench('belief lens (with memo cache)', () => {
      const cache = createMemoCache();
      // Warm cache with first pass
      evaluate(items, beliefLensObj, view, { memoCache: cache });
      // Second pass should be cache hits
      evaluate(items, beliefLensObj, view, { memoCache: cache });
    });
  });

  describe('evaluate 10k items', () => {
    const items = makeItems(10000);

    bench('belief lens (cold)', () => {
      resetMemoCache();
      evaluate(items, beliefLensObj, view);
    });
  });
});
