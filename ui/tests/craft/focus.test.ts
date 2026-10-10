import { describe, expect, it } from 'vitest';
import { TOKENS, THEME_NAMES } from '../../src/client/styles/tokens.generated.js';

const FOCUS_TOKENS = [
  'colors.semantic.border-focus',
  'colors.semantic.focus-ring',
  'shadows.focus',
] as const;

describe('craft: focus visibility', () => {
  for (const theme of THEME_NAMES) {
    describe(`theme: ${theme}`, () => {
      it('has focus ring tokens defined', () => {
        const tokens = TOKENS[theme];
        for (const key of FOCUS_TOKENS) {
          expect(tokens[key]).toBeDefined();
          expect(tokens[key].length).toBeGreaterThan(0);
        }
      });

      it('focus ring is not the same as background', () => {
        const tokens = TOKENS[theme];
        const focusRing = tokens['colors.semantic.focus-ring'];
        const bgBase = tokens['colors.semantic.bg-base'];
        const bgPanel = tokens['colors.semantic.bg-panel'];
        expect(focusRing).not.toBe(bgBase);
        expect(focusRing).not.toBe(bgPanel);
      });

      it('focus ring is not the same as text primary', () => {
        const tokens = TOKENS[theme];
        const focusRing = tokens['colors.semantic.focus-ring'];
        const textPrimary = tokens['colors.semantic.text-primary'];
        expect(focusRing).not.toBe(textPrimary);
      });
    });
  }
});