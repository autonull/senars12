import { describe, expect, it } from 'vitest';
import { TOKENS, THEME_NAMES } from '../../src/client/styles/tokens.generated.js';

const Z_INDEX_LAYERS = [
  { key: 'zIndex.layers.base', order: 0 },
  { key: 'zIndex.layers.dropdown', order: 1 },
  { key: 'zIndex.layers.tooltip', order: 2 },
  { key: 'zIndex.layers.panel', order: 3 },
  { key: 'zIndex.layers.modal', order: 4 },
  { key: 'zIndex.layers.toast', order: 5 },
  { key: 'zIndex.layers.palette', order: 6 },
] as const;

describe('craft: z-index order', () => {
  for (const theme of THEME_NAMES) {
    describe(`theme: ${theme}`, () => {
      it('has all z-index layers defined', () => {
        const tokens = TOKENS[theme];
        for (const layer of Z_INDEX_LAYERS) {
          expect(tokens[layer.key]).toBeDefined();
        }
      });

      it('z-index layers are in correct hierarchical order', () => {
        const tokens = TOKENS[theme];
        const values = Z_INDEX_LAYERS.map((layer) => parseInt(tokens[layer.key], 10));

        for (let i = 1; i < values.length; i++) {
          expect(values[i]).toBeGreaterThan(values[i - 1]);
        }
      });

      it('z-index values are reasonable (not excessively large)', () => {
        const tokens = TOKENS[theme];
        for (const layer of Z_INDEX_LAYERS) {
          const value = parseInt(tokens[layer.key], 10);
          expect(value).toBeLessThan(10000);
        }
      });
    });
  }

  it('z-index order is consistent across themes', () => {
    const baseTheme = TOKENS[THEME_NAMES[0]];
    for (const theme of THEME_NAMES.slice(1)) {
      const tokens = TOKENS[theme];
      for (const layer of Z_INDEX_LAYERS) {
        expect(tokens[layer.key]).toBe(baseTheme[layer.key]);
      }
    }
  });
});