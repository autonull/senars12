import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { flattenTokens, resolveTheme, type TokenTree, type FlatTokens } from '../src/client/utils/token-utils.js';

const DEFAULT_THEME = 'dark';

const toCssVar = (path: string): string => `--${path.replace(/\./g, '-')}`;

function cssBlock(selector: string, tokens: FlatTokens): string {
  const body = Object.entries(tokens)
    .map(([path, value]) => `  ${toCssVar(path)}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}

function generateReducedMotionBlock(): string {
  return `@media (prefers-reduced-motion: reduce) {
  :root {
    --transitions-fast: 0ms;
    --transitions-normal: 0ms;
    --transitions-slow: 0ms;
    --motion-durations-fast: 0ms;
    --motion-durations-normal: 0ms;
    --motion-durations-slow: 0ms;
    --motion-durations-slower: 0ms;
  }
}`;
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
    `/* Auto-generated from design-tokens.json */\n${cssSections.join('\n\n')}\n\n${generateReducedMotionBlock()}\n`
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
