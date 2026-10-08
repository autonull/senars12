import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_NAMES,
  TOKENS,
} from '../src/client/styles/tokens.generated.js';
import { cssVar, getTheme, setTheme, theme, token } from '../src/client/utils/theme.js';

type Tree = Record<string, unknown>;

const HERE = dirname(fileURLToPath(import.meta.url));
const readText = (rel: string): string => readFileSync(resolve(HERE, rel), 'utf-8');
const readJson = (rel: string): Tree => JSON.parse(readText(rel));

function flatten(obj: Tree, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return Object.entries(flatten(value as Tree, path));
      }
      return [[path, String(value)]];
    })
  );
}

function resolveRefs(value: string, flat: Record<string, string>): string {
  return value.replace(/\{([^}]+)\}/g, (_, path: string) => {
    const resolved = flat[path];
    if (resolved === undefined) throw new Error(`Missing token: ${path}`);
    return resolveRefs(resolved, flat);
  });
}

function expectedTokens(): Record<string, Record<string, string>> {
  const raw = readJson('../design-tokens.json');
  const { themes, ...base } = raw;
  const baseFlat = flatten(base);
  const names = [DEFAULT_THEME, ...Object.keys((themes as Tree) ?? {})];
  return Object.fromEntries(
    names.map((name) => {
      const overrides = name === DEFAULT_THEME ? {} : flatten((themes as Tree)[name] as Tree);
      const flat = { ...baseFlat, ...overrides };
      return [
        name,
        Object.fromEntries(Object.entries(flat).map(([path, value]) => [path, resolveRefs(value, flat)])),
      ];
    })
  );
}

function parseThemeCss(): Record<string, Record<string, string>> {
  const css = readText('../src/client/styles/tokens.css');
  const blocks = new Map<string, string>();
  for (const match of css.matchAll(/(:root(?:\[data-theme="[^"]+"\])?)\s*\{([^}]*)\}/g)) {
    blocks.set(match[1], match[2]);
  }
  return Object.fromEntries(
    THEME_NAMES.map((name) => {
      const selector = name === DEFAULT_THEME ? ':root' : `:root[data-theme="${name}"]`;
      const body = blocks.get(selector);
      if (body === undefined) throw new Error(`Missing CSS block: ${selector}`);
      const vars = Object.fromEntries(
        [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
      );
      return [name, vars];
    })
  );
}

const cssVarValue = (tokens: Record<string, string>) =>
  Object.fromEntries(Object.entries(tokens).map(([path, value]) => [cssVar(path), value]));

describe('design tokens — generated parity', () => {
  it('tokens.generated.ts matches design-tokens.json for every theme', () => {
    expect(TOKENS).toEqual(expectedTokens());
  });

  it('tokens.css matches design-tokens.json for every theme', () => {
    const fromCss = parseThemeCss();
    for (const name of THEME_NAMES) {
      expect(fromCss[name]).toEqual(cssVarValue(TOKENS[name]));
    }
  });
});

describe('theme facade', () => {
  it('reads the default theme by default', () => {
    expect(getTheme()).toBe(DEFAULT_THEME);
    expect(token('colors.primitive.void')).toBe(TOKENS[DEFAULT_THEME]['colors.primitive.void']);
    expect(theme.colors.void).toBe(TOKENS[DEFAULT_THEME]['colors.primitive.void']);
  });

  it('falls back to the default theme for an unknown path', () => {
    expect(token('does.not.exist', 'fallback')).toBe('fallback');
  });

  it('switches theme values and the document attribute', () => {
    setTheme('light');
    expect(getTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(token('colors.primitive.void')).toBe(TOKENS.light['colors.primitive.void']);
    expect(theme.colors.void).toBe(TOKENS.light['colors.primitive.void']);
    expect(token('colors.primitive.void')).not.toBe(TOKENS[DEFAULT_THEME]['colors.primitive.void']);
    setTheme(DEFAULT_THEME);
    delete document.documentElement.dataset.theme;
  });
});
