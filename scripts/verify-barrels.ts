#!/usr/bin/env tsx
/**
 * Barrel gate: one barrel per directory, and it names what it exports.
 *
 * §2.1 split nine directories into a contract at the top and implementations
 * under `impls/`. The naming rule that made those moves mechanical then forces
 * the barrels to be explicit, and explicit barrels have a cost that is easy to
 * forget: adding a module means editing the barrel, and a forgotten line is a
 * silent omission rather than a compile error.
 *
 * Two rules, and the second is the one that closes the gap:
 *
 *  - **No `export *`.** A star re-export is a second, unversioned index of the
 *    directory: it re-exports whatever a file gains next month, which is the
 *    opposite of a declared surface. `nar/src/game/index.ts` already showed
 *    the target shape — one name at a time.
 *  - **No orphan module.** A module is reachable if its barrel names it, a
 *    declared export subpath points at it, or something outside its own
 *    directory imports it. One that is reachable by none of the three is
 *    invisible: newly written and not yet wired reads exactly like private.
 *    That is the §8.6 failure, and it is a report rather than a silence.
 *
 * A private module is not a false positive here — it is imported by its
 * directory's siblings, which is the third clause. The check asks whether a
 * file is *reachable*, not whether it is *public*, because reachability is the
 * thing that can be measured and the public surface is the thing the barrel
 * already declares.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { importEdges } from './lib/imports.js';
import { entryTargets, readPackageJson } from './lib/pkg.js';
import { ROOT } from './lib/root.js';
import { moduleSource, sourceFiles } from './lib/source-scan.js';

const PACKAGES = ['util', 'core', 'nar', 'io', 'metta'];

/** Every module in a package, keyed by its path relative to the package's `src`. */
const moduleIndex = (pkg: string): Map<string, string[]> => {
  const root = join(ROOT, pkg, 'src');
  if (!existsSync(root)) return new Map();
  const index = new Map<string, string[]>();
  for (const file of sourceFiles(root)) {
    const key = relative(root, file).replace(/\.ts$/, '');
    index.set(
      key,
      importEdges(readFileSync(file, 'utf-8')).map((edge) => edge.specifier)
    );
  }
  return index;
};

/** Resolves a relative specifier to a key in the index, or undefined if it leaves the package. */
const resolve = (
  from: string,
  specifier: string,
  index: Map<string, string[]>
): string | undefined => {
  if (!specifier.startsWith('.')) return undefined;
  const segments = from.split('/');
  segments.pop();
  for (const segment of specifier.split('/')) {
    if (segment === '.' || segment === '') continue;
    else if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  const key = segments.join('/').replace(/\.js$/, '');
  return index.has(key) ? key : undefined;
};

const problems: string[] = [];

for (const pkg of PACKAGES) {
  const srcRoot = join(ROOT, pkg, 'src');
  if (!existsSync(srcRoot)) continue;
  const index = moduleIndex(pkg);

  // Declared export subpaths claim modules by name, so a module reached that
  // way is reachable whether or not the barrel repeats it. A wildcard subpath
  // (`./agent/*`) claims its whole subtree.
  const manifest = readPackageJson(ROOT, pkg);
  const claimed = new Set<string>();
  const wildcards: string[] = [];
  for (const entry of Object.values(manifest?.exports ?? {})) {
    for (const target of entryTargets(entry as never)) {
      if (!target.startsWith('./src/')) continue;
      const key = target.slice('./src/'.length).replace(/\.ts$/, '');
      if (key.includes('*')) wildcards.push(key.slice(0, key.indexOf('*')));
      else claimed.add(key);
    }
  }
  const isClaimed = (key: string): boolean =>
    claimed.has(key) || wildcards.some((prefix) => key.startsWith(prefix));

  for (const dir of readdirSync(srcRoot).filter((d) => statSync(join(srcRoot, d)).isDirectory())) {
    const barrelPath = join(srcRoot, dir, 'index.ts');
    if (!existsSync(barrelPath)) continue;
    const barrel = readFileSync(barrelPath, 'utf-8');
    const label = `${pkg}/src/${dir}`;

    if (/export \*/.test(barrel)) {
      const stars = (barrel.match(/export \*/g) ?? []).length;
      problems.push(
        `${label}/index.ts re-exports ${stars} module(s) with \`export *\` — name them, so the\n` +
          `    barrel is a declared surface rather than a second unversioned index of the directory`
      );
      continue;
    }

    const named = new Set(importEdges(barrel).map((e) => e.specifier));
    for (const file of readdirSync(join(srcRoot, dir)).filter(moduleSource)) {
      if (file === 'index.ts') continue;
      const key = `${dir}/${file.replace(/\.ts$/, '')}`;
      if (isClaimed(key)) continue;
      const isNamed = [...named].some((s) => resolve(`${dir}/index`, s, index) === key);
      if (isNamed) continue;
      const importedFromOutside = [...index].some(
        ([other, specifiers]) =>
          other !== key && specifiers.some((s) => resolve(other, s, index) === key)
      );
      if (importedFromOutside) continue;
      problems.push(
        `${label}/${file} is named by nothing — its barrel, a declared export subpath, and every\n` +
          '    module in the package all pass over it'
      );
    }
  }
}

if (problems.length > 0) {
  console.error('exports:barrels FAILED — a directory has no declared surface:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('exports:barrels ok — every barrel names its exports, and no module is unreachable');
