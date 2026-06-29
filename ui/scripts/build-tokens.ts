import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

interface TokenTree {
  [key: string]: unknown;
}
type FlatTokens = Record<string, string>;

function resolveRefs(value: string, flat: FlatTokens, visited = new Set<string>()): string {
  return value.replace(/\{([^}]+)\}/g, (_, path) => {
    if (visited.has(path)) throw new Error(`Circular reference: ${path}`);
    visited.add(path);
    const resolved = flat[path];
    if (resolved === undefined) throw new Error(`Missing token: ${path}`);
    if (resolved.match(/\{/)) {
      return resolveRefs(resolved, flat, visited);
    }
    return resolved;
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

function toCssVar(path: string): string {
  return `--${path.replace(/\./g, '-')}`;
}

function toTsKey(path: string): string {
  return path.replace(/\./g, '_');
}

function generate(filePath: string) {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as TokenTree;
  const flat = flattenTokens(raw);

  const cssDir = resolve('src/client/styles');
  mkdirSync(cssDir, { recursive: true });

  const cssEntries: [string, string][] = Object.entries(flat).map(([path, value]) => {
    const cssPath = toCssVar(path);
    const resolvedValue = resolveRefs(value, flat);
    return [cssPath, resolvedValue];
  });

  const cssContent = cssEntries.map(([k, v]) => `  ${k}: ${v};`).join('\n');
  writeFileSync(
    resolve(cssDir, 'tokens.css'),
    `/* Auto-generated from design-tokens.json */\n:root {\n${cssContent}\n}\n`
  );
  console.log('-> Generated tokens.css');

  const tsContent = `// Auto-generated from design-tokens.json
export const tokens = {
${Object.entries(flat)
  .map(([path, value]) => {
    const k = toTsKey(path);
    const v = resolveRefs(value, flat);
    return `  '${k}': '${v}' as const,`;
  })
  .join('\n')}
} as const;

export type TokenPath = keyof typeof tokens;
`;
  writeFileSync(resolve(cssDir, 'tokens.ts'), tsContent);
  console.log('-> Generated tokens.ts');
}

const designTokensPath = resolve('design-tokens.json');
generate(designTokensPath);
