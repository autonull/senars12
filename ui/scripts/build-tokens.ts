import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface TokenTree {
  [key: string]: unknown;
}

type FlatTokens = Record<string, string>;

const DEFAULT_THEME = 'dark';

function resolveRefs(value: string, flat: FlatTokens, visited = new Set<string>()): string {
  return value.replace(/\{([^}]+)\}/g, (_, path) => {
    if (visited.has(path)) throw new Error(`Circular reference: ${path}`);
    visited.add(path);
    const resolved = flat[path];
    if (resolved === undefined) throw new Error(`Missing token: ${path}`);
    return resolved.match(/\{/) ? resolveRefs(resolved, flat, visited) : resolved;
  });
}

function flattenTokens(obj: TokenTree, prefix = ''): FlatTokens {
  const result: FlatTokens = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value as TokenTree, path));
    } else {
      result[path] = String(value);
    }
  }
  return result;
}

const toCssVar = (path: string): string => `--${path.replace(/\./g, '-')}`;

/** Every token path resolved to a literal value for one theme. */
function resolveTheme(base: FlatTokens, overrides: FlatTokens): FlatTokens {
  const flat = { ...base, ...overrides };
  return Object.fromEntries(
    Object.entries(flat).map(([path, value]) => [path, resolveRefs(value, flat)])
  );
}

function cssBlock(selector: string, tokens: FlatTokens): string {
  const body = Object.entries(tokens)
    .map(([path, value]) => `  ${toCssVar(path)}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

function generate(filePath: string) {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as TokenTree;
  const { themes, ...base } = raw;
  const baseFlat = flattenTokens(base);

  const themeNames = [DEFAULT_THEME, ...Object.keys((themes as TokenTree) ?? {})];
  const resolved: Record<string, FlatTokens> = {};
  for (const name of themeNames) {
    const overrides = name === DEFAULT_THEME ? {} : flattenTokens((themes as TokenTree)[name] as TokenTree);
    resolved[name] = resolveTheme(baseFlat, overrides);
  }

  const cssDir = resolve('src/client/styles');
  mkdirSync(cssDir, { recursive: true });

  const cssSections = themeNames.map((name, i) => {
    const selector = i === 0 ? ':root' : `:root[data-theme="${name}"]`;
    return cssBlock(selector, resolved[name]);
  });
  writeFileSync(
    resolve(cssDir, 'tokens.css'),
    `/* Auto-generated from design-tokens.json */\n${cssSections.join('\n\n')}\n`
  );
  console.log('-> Generated tokens.css');

  const ts = [
    '/* Auto-generated from design-tokens.json — do not edit. */',
    `export type ThemeName = ${themeNames.map((n) => `'${n}'`).join(' | ')};`,
    `export const DEFAULT_THEME: ThemeName = '${DEFAULT_THEME}';`,
    `export const THEME_NAMES: readonly ThemeName[] = ${JSON.stringify(themeNames)};`,
    'export const TOKENS: Record<ThemeName, Readonly<Record<string, string>>> = {',
    ...themeNames.map(
      (name) => `  ${JSON.stringify(name)}: ${JSON.stringify(resolved[name], null, 2)},`
    ),
    '};',
    '',
  ].join('\n');
  writeFileSync(resolve(cssDir, 'tokens.generated.ts'), ts);
  console.log('-> Generated tokens.generated.ts');
}

generate(resolve('design-tokens.json'));
