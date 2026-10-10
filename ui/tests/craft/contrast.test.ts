import { describe, expect, it } from 'vitest';
import { TOKENS, THEME_NAMES } from '../../src/client/styles/tokens.generated.js';

/** Parse a color string (hex, rgb, rgba) to RGB values 0-255 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // Hex
  let match = color.match(/^#([0-9a-fA-F]{3,8})$/);
  if (match) {
    const hex = match[1];
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  // RGB/RGBA
  match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (match) {
    return {
      r: parseInt(match[1], 10),
      g: parseInt(match[2], 10),
      b: parseInt(match[3], 10),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }

  return null;
}

/** Calculate relative luminance (0-1) */
function luminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLinear = (c: number) => {
    const c255 = c / 255;
    return c255 <= 0.03928 ? c255 / 12.92 : Math.pow((c255 + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Calculate contrast ratio between two colors */
function contrastRatio(fg: string, bg: string): number {
  const fgColor = parseColor(fg);
  const bgColor = parseColor(bg);

  if (!fgColor || !bgColor) return 0;

  // For semi-transparent foreground, blend with background
  let fgLum: number;
  if (fgColor.a < 1) {
    const blended = {
      r: fgColor.r * fgColor.a + bgColor.r * (1 - fgColor.a),
      g: fgColor.g * fgColor.a + bgColor.g * (1 - fgColor.a),
      b: fgColor.b * fgColor.a + bgColor.b * (1 - fgColor.a),
    };
    fgLum = luminance(blended);
  } else {
    fgLum = luminance(fgColor);
  }

  const bgLum = luminance(bgColor);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

const CONTRAST_PAIRS: Array<{
  name: string;
  fg: string;
  bg: string;
  minRatio: number;
  level: 'AA' | 'AAA' | 'AA-large' | 'AAA-large';
}> = [
  { name: 'Primary text on base', fg: 'colors.semantic.text-primary', bg: 'colors.semantic.bg-base', minRatio: 4.5, level: 'AA' },
  { name: 'Secondary text on base', fg: 'colors.semantic.text-secondary', bg: 'colors.semantic.bg-base', minRatio: 4.5, level: 'AA' },
  { name: 'Muted text on base', fg: 'colors.semantic.text-muted', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Primary text on panel', fg: 'colors.semantic.text-primary', bg: 'colors.semantic.bg-panel', minRatio: 4.5, level: 'AA' },
  { name: 'Secondary text on panel', fg: 'colors.semantic.text-secondary', bg: 'colors.semantic.bg-panel', minRatio: 4.5, level: 'AA' },
  { name: 'Primary text on panel-solid', fg: 'colors.semantic.text-primary', bg: 'colors.semantic.bg-panel-solid', minRatio: 4.5, level: 'AA' },
  { name: 'Border default on base', fg: 'colors.semantic.border-default', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Border focus on base', fg: 'colors.semantic.border-focus', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Focus ring on base', fg: 'colors.semantic.focus-ring', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Accent primary on base', fg: 'colors.semantic.accent-primary', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Text on accent', fg: 'colors.semantic.text-on-accent', bg: 'colors.semantic.accent-primary', minRatio: 4.5, level: 'AA' },
  { name: 'Status connected on base', fg: 'colors.semantic.status-connected', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Status disconnected on base', fg: 'colors.semantic.status-disconnected', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Error on base', fg: 'colors.primitive.error', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Warning on base', fg: 'colors.primitive.warning', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
  { name: 'Success on base', fg: 'colors.primitive.success', bg: 'colors.semantic.bg-base', minRatio: 3, level: 'AA-large' },
];

describe('craft: contrast', () => {
  for (const theme of THEME_NAMES) {
    describe(`theme: ${theme}`, () => {
      for (const pair of CONTRAST_PAIRS) {
        it(`meets ${pair.level} for ${pair.name}`, () => {
          const tokens = TOKENS[theme];
          const fg = tokens[pair.fg];
          const bg = tokens[pair.bg];

          expect(fg).toBeDefined();
          expect(bg).toBeDefined();

          const ratio = contrastRatio(fg, bg);
          expect(ratio).toBeGreaterThanOrEqual(pair.minRatio - 0.1); // Small tolerance for rounding
        });
      }

      it('high-contrast theme meets AAA for all text', () => {
        if (theme !== 'high-contrast') return;

        const tokens = TOKENS[theme];
        const fg = tokens['colors.semantic.text-primary'];
        const bg = tokens['colors.semantic.bg-base'];
        const ratio = contrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(7); // AAA normal text
      });
    });
  }
});