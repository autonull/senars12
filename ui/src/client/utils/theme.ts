import {
  DEFAULT_THEME,
  THEME_NAMES,
  TOKENS,
  type ThemeName,
} from '../styles/tokens.generated.js';

export type { ThemeName };
export { THEME_NAMES };

let active: ThemeName = DEFAULT_THEME;

/** The theme currently applied by the facade (and, in the browser, `data-theme`). */
export const getTheme = (): ThemeName => active;

/**
 * Switch the active theme. Updates the generated token map the facade reads and
 * reflects the choice on `<html data-theme>` so the generated `tokens.css`
 * override block takes effect for CSS consumers.
 */
export function setTheme(name: ThemeName): void {
  active = name;
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = name;
}

/** CSS custom-property name for a dotted token path (`colors.primitive.void`). */
export const cssVar = (path: string): string => `--${path.replace(/\./g, '-')}`;

/** Resolved value of a token in the active theme, falling back to the default theme. */
export function token(path: string, fallback = ''): string {
  return TOKENS[active]?.[path] ?? TOKENS[DEFAULT_THEME][path] ?? fallback;
}

/**
 * Read a live CSS custom property from the document root — for canvas consumers
 * that need whatever stylesheet overrides are in effect. Falls back to `fallback`.
 */
export function cssToken(name: string, fallback = ''): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * The one runtime reader of `design-tokens.json`. A single source shared by CSS
 * (via the generated `tokens.css`), Cytoscape/Three/Chart adapters, canvas
 * painters, and Lit templates — replacing `TOKEN_COLORS` and inline hex.
 *
 * Color entries are getters, so reads track the active theme instead of the
 * theme that happened to be active at import time.
 */
export const theme = {
  colors: {
    get accentCyan() {
      return token('colors.primitive.accent-cyan');
    },
    get accentAmber() {
      return token('colors.primitive.accent-amber');
    },
    get accentMagenta() {
      return token('colors.primitive.accent-magenta');
    },
    get textPrimary() {
      return token('colors.primitive.text-primary');
    },
    get textSecondary() {
      return token('colors.primitive.text-secondary');
    },
    get textMuted() {
      return token('colors.primitive.text-dim');
    },
    get borderDefault() {
      return token('colors.primitive.border-default');
    },
    get borderDim() {
      return token('colors.primitive.border-dim');
    },
    get success() {
      return token('colors.primitive.success');
    },
    get error() {
      return token('colors.primitive.error');
    },
    get warning() {
      return token('colors.primitive.warning');
    },
    get info() {
      return token('colors.primitive.info');
    },
    get focusRing() {
      return token('colors.primitive.focus-ring');
    },
    get void() {
      return token('colors.primitive.void');
    },
  },
} as const;
