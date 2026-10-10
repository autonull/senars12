import { describe, expect, it } from 'vitest';
import { TOKENS, THEME_NAMES } from '../../src/client/styles/tokens.generated.js';

const TYPOGRAPHY_SCALE_KEYS = [
  'typography.scale.xs',
  'typography.scale.sm',
  'typography.scale.base',
  'typography.scale.lg',
  'typography.scale.xl',
  'typography.scale.2xl',
  'typography.scale.3xl',
] as const;

const LINE_HEIGHT_KEYS = [
  'typography.lineHeights.tight',
  'typography.lineHeights.normal',
  'typography.lineHeights.relaxed',
] as const;

const FONT_WEIGHT_KEYS = [
  'typography.fontWeights.normal',
  'typography.fontWeights.medium',
  'typography.fontWeights.semibold',
  'typography.fontWeights.bold',
] as const;

const FONT_FAMILY_KEYS = [
  'typography.fontFamilies.ui',
  'typography.fontFamilies.data',
  'typography.fontFamilies.mono',
] as const;

describe('craft: typography', () => {
  for (const theme of THEME_NAMES) {
    describe(`theme: ${theme}`, () => {
      it('has a complete typographic scale with monotonically increasing sizes', () => {
        const tokens = TOKENS[theme];
        const sizes = TYPOGRAPHY_SCALE_KEYS.map((key) => parseFloat(tokens[key]));

        for (let i = 1; i < sizes.length; i++) {
          expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
        }
      });

      it('has valid line heights', () => {
        const tokens = TOKENS[theme];
        for (const key of LINE_HEIGHT_KEYS) {
          const value = parseFloat(tokens[key]);
          expect(value).toBeGreaterThanOrEqual(1);
          expect(value).toBeLessThanOrEqual(2.5);
        }
      });

      it('has valid font weights in range 100-900', () => {
        const tokens = TOKENS[theme];
        for (const key of FONT_WEIGHT_KEYS) {
          const value = parseInt(tokens[key], 10);
          expect(value).toBeGreaterThanOrEqual(100);
          expect(value).toBeLessThanOrEqual(900);
        }
      });

      it('has font families defined', () => {
        const tokens = TOKENS[theme];
        for (const key of FONT_FAMILY_KEYS) {
          const value = tokens[key];
          expect(value).toBeTruthy();
          expect(value.length).toBeGreaterThan(0);
        }
      });
    });
  }

  it('typography scale is consistent across themes', () => {
    const baseTheme = TOKENS[THEME_NAMES[0]];
    for (const theme of THEME_NAMES.slice(1)) {
      const tokens = TOKENS[theme];
      for (const key of TYPOGRAPHY_SCALE_KEYS) {
        expect(tokens[key]).toBe(baseTheme[key]);
      }
      for (const key of LINE_HEIGHT_KEYS) {
        expect(tokens[key]).toBe(baseTheme[key]);
      }
      for (const key of FONT_WEIGHT_KEYS) {
        expect(tokens[key]).toBe(baseTheme[key]);
      }
      for (const key of FONT_FAMILY_KEYS) {
        expect(tokens[key]).toBe(baseTheme[key]);
      }
    }
  });
});