#!/usr/bin/env tsx
/**
 * API documentation generator (TODO20 A2).
 *
 * Renders `docs/api/<pkg>.md` from each @senars/* package's exports map:
 * per subpath, the exported symbol names (from the entry source) plus their
 * leading JSDoc summary. Dependency-light — TypeDoc is blocked on TypeScript 7
 * (typedoc 0.28 requires ts ≤5); revisit when typedoc gains TS7 support.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const PACKAGES = ['nar', 'core', 'util', 'io', 'metta'];
const OUT = join(ROOT, 'docs', 'api');

type ExportEntry = string | { import?: string; types?: string; default?: string };

const entryFileOf = (pkg: string, entry: ExportEntry): string | null => {
  const target = typeof entry === 'string' ? entry : (entry.import ?? entry.types ?? entry.default);
  if (!target) return null;
  const src = target
    .replace(/^\.\/dist\//, './src/')
    .replace(/\.js$/, '.ts')
    .replace(/\.d\.ts$/, '.ts');
  const path = join(ROOT, pkg, src);
  if (existsSync(path)) {
    try {
      if (statSync(path).isDirectory()) {
        const index = join(path, 'index.ts');
        return existsSync(index) ? index : null;
      }
    } catch {
      return null;
    }
    return path;
  }
  // Wildcard or missing target: no single entry file to document.
  return null;
};

/** One-hop resolution of `export { ... } from './x.js'` targets. */
const resolveRef = (fromFile: string, ref: string): string | null => {
  if (!ref.startsWith('.')) return null;
  let target = join(fromFile, '..', ref.replace(/\.js$/, '.ts'));
  if (!target.endsWith('.ts')) target = join(target, 'index.ts');
  if (target === fromFile || !existsSync(target) || !target.endsWith('.ts')) return null;
  try {
    if (!statSync(target).isFile()) return null;
  } catch {
    return null;
  }
  return target;
};

const followReexport = (
  fromFile: string,
  names: string[],
  seen: Set<string>
): Map<string, string> => {
  const text = readFileSync(fromFile, 'utf-8');
  const summaries = new Map<string, string>();
  const re = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of text.matchAll(re)) {
    const ref = m[2]!;
    const target = ref.startsWith('.')
      ? join(fromFile, '..', ref.replace(/\.js$/, '.ts').replace(/\/index\.ts$/, '/index.ts'))
      : null;
    if (!target || !existsSync(target)) continue;
    const targetSummary = new Map(describeEntry(target).map((s) => [s.name, s.summary]));
    for (const raw of m[1]!.split(',')) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()!
        .trim();
      const summary = targetSummary.get(name);
      if (summary && !summaries.has(name)) summaries.set(name, summary);
    }
  }
  return summaries;
};

/** Exported symbol names + first JSDoc summary line from a source file. */
const describeEntry = (file: string): Array<{ name: string; summary: string }> => {
  if (!statSync(file).isFile()) {
    console.error(`  ! skipping non-file entry: ${file}`);
    return [];
  }
  const text = readFileSync(file, 'utf-8');
  const out: Array<{ name: string; summary: string }> = [];
  const exportRe =
    /^export (?:async )?(?:const|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/gm;
  const jsdocRe =
    /\/\*\*([\s\S]*?)\*\/\s*(?:export )?(?:async )?(?:const|function|class|interface|type|enum)\s+[A-Za-z0-9_]+/g;
  const summaries = new Map<string, string>();
  for (const m of text.matchAll(jsdocRe)) {
    const decl = /(?:export )?(?:const|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/.exec(
      m[0].slice(m[0].lastIndexOf('export') >= 0 ? m[0].indexOf('export') : 0)
    );
    const name =
      decl?.[1] ??
      /(?:const|function|class|interface|type|enum)\s+([A-Za-z0-9_]+)/.exec(m[0].slice(-80))?.[1];
    if (!name || summaries.has(name)) continue;
    const summary = m[1]!
      .split('\n')
      .map((l) => l.replace(/^\s*\*\s?/, '').trim())
      .filter((l) => l && !l.startsWith('@'))[0];
    if (summary) summaries.set(name, summary);
  }
  for (const m of text.matchAll(exportRe)) {
    out.push({ name: m[1]!, summary: summaries.get(m[1]!) ?? '' });
  }
  // Re-exports: pull summaries through one hop so barrels document too.
  const reexportNames = [...text.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g)]
    .flatMap((m) => m[1]!.split(','))
    .map((raw) =>
      raw
        .trim()
        .split(/\s+as\s+/)
        .pop()!
        .trim()
    )
    .filter(Boolean);
  const viaReexport = followReexport(file, reexportNames, new Set([file]));
  for (const name of reexportNames) {
    if (out.some((s) => s.name === name)) continue;
    out.push({ name, summary: viaReexport.get(name) ?? '' });
  }
  return out;
};

const main = (): void => {
  mkdirSync(OUT, { recursive: true });
  let entries = 0;
  for (const pkg of PACKAGES) {
    const pkgJson = JSON.parse(readFileSync(join(ROOT, pkg, 'package.json'), 'utf-8')) as {
      exports?: Record<string, ExportEntry>;
    };
    if (!pkgJson.exports) continue;
    const lines: string[] = [`# @senars/${pkg} — public API`, ''];
    for (const [sub, entry] of Object.entries(pkgJson.exports)) {
      const file = entryFileOf(pkg, entry);
      lines.push(`## \`${sub}\``);
      if (!file) {
        lines.push('', '_Dynamic subpath (no single entry file)._');
      } else {
        const symbols = describeEntry(file);
        entries += symbols.length;
        if (symbols.length === 0) lines.push('', '_Re-export barrel._');
        else
          for (const { name, summary } of symbols)
            lines.push('', `- \`${name}\`${summary ? ` — ${summary}` : ''}`);
      }
      lines.push('');
    }
    writeFileSync(join(OUT, `${pkg}.md`), lines.join('\n'));
  }
  console.log(
    `✓ docs:api — wrote ${PACKAGES.length} package docs (${entries} symbols) to docs/api/`
  );
};

main();
