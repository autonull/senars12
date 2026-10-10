import { describe, expect, it } from 'vitest';
import { TOKENS, THEME_NAMES } from '../../src/client/styles/tokens.generated.js';

const DURATION_KEYS = [
  'motion.durations.instant',
  'motion.durations.fast',
  'motion.durations.normal',
  'motion.durations.slow',
  'motion.durations.slower',
] as const;

const EASING_KEYS = [
  'motion.easings.ease',
  'motion.easings.ease-in',
  'motion.easings.ease-out',
  'motion.easings.ease-in-out',
  'motion.easings.spring',
] as const;

const REDUCED_MOTION_KEYS = [
  'motion.reducedMotion.durations.fast',
  'motion.reducedMotion.durations.normal',
  'motion.reducedMotion.durations.slow',
  'motion.reducedMotion.durations.slower',
] as const;

const TRANSITION_KEYS = [
  'transitions.fast',
  'transitions.normal',
  'transitions.slow',
] as const;

describe('craft: motion', () => {
  for (const theme of THEME_NAMES) {
    describe(`theme: ${theme}`, () => {
      it('has all duration tokens defined', () => {
        const tokens = TOKENS[theme];
        for (const key of DURATION_KEYS) {
          expect(tokens[key]).toBeDefined();
          expect(tokens[key]).toMatch(/^\d+ms$/);
        }
      });

      it('has all easing tokens defined', () => {
        const tokens = TOKENS[theme];
        for (const key of EASING_KEYS) {
          expect(tokens[key]).toBeDefined();
          expect(tokens[key].length).toBeGreaterThan(0);
        }
      });

      it('durations are monotonically increasing', () => {
        const tokens = TOKENS[theme];
        const durations = DURATION_KEYS.map((key) => parseInt(tokens[key], 10));

        for (let i = 1; i < durations.length; i++) {
          expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1]);
        }
      });

      it('reduced motion durations are all zero', () => {
        const tokens = TOKENS[theme];
        for (const key of REDUCED_MOTION_KEYS) {
          expect(tokens[key]).toBe('0ms');
        }
      });

      it('transition tokens reference motion durations and easings', () => {
        const tokens = TOKENS[theme];
        for (const key of TRANSITION_KEYS) {
          const value = tokens[key];
          expect(value).toMatch(/^\d+ms\s+/);
        }
      });
    });
  }

  it('motion tokens are consistent across themes (except high-contrast may differ)', () => {
    const baseTheme = TOKENS[THEME_NAMES[0]];
    for (const theme of THEME_NAMES.slice(1)) {
      if (theme === 'high-contrast') continue; // High contrast may have different motion
      const tokens = TOKENS[theme];
      for (const key of [...DURATION_KEYS, ...EASING_KEYS, ...REDUCED_MOTION_KEYS, ...TRANSITION_KEYS]) {
        expect(tokens[key]).toBe(baseTheme[key]);
      }
    }
  });
});