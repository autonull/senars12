#!/usr/bin/env tsx
/**
 * The README's rule matrix, generated from the loaded table.
 *
 * It was transcribed, and it had already drifted: `nar.extended.exemplification`
 * was listed twice, `nal.higherOrderDeduction` and `nal.contrapositionRule` do not
 * exist under those ids, and the "Meta-Cognitive — none" row described a category
 * with no members. A hand-maintained list of a generated table is the second
 * source of truth §11.1 names, and this closes it: the matrix is a projection of
 * `BUILTIN_DECLARATIONS`, so a rule cannot be added, renamed or removed without
 * the README changing in the same commit — and `docs:drift` fails if it does not.
 *
 * Rows are **dispatch cells** — the pattern pair a rule declares — because that
 * is what dispatch actually keys on (TODO29.a §5.6) and it is the one grouping
 * the table can be wrong about. The transcribed version grouped by a category
 * word that existed nowhere in the code, which is why two of its rows were
 * aspirational and one listed a rule twice.
 */
import { BUILTIN_DECLARATIONS } from '../nar/src/rules/impls/registration.js';

const START = '<!-- rule-matrix:start -->';
const END = '<!-- rule-matrix:end -->';

export const renderMatrix = (
  declarations: readonly {
    ruleId: string;
    left: { op: string };
    right: { op: string };
    truthFn: string;
  }[]
): string => {
  const cells = new Map<string, string[]>();
  for (const declaration of declarations) {
    const cell = `\`${declaration.left.op}:${declaration.right.op}\``;
    cells.set(cell, [
      ...(cells.get(cell) ?? []),
      `\`${declaration.ruleId}\` (${declaration.truthFn})`,
    ]);
  }
  const rows = [...cells]
    .sort(([a], [b]) => b.length - a.length || a.localeCompare(b))
    .map(([cell, rules]) => `| ${cell} | ${rules.length} | ${rules.join(', ')} |`);
  return [
    '| Dispatch cell | Rules | Declarations |',
    '|---|---|---|',
    ...rows,
    '',
    `_${declarations.length} declarations in ${cells.size} cells, loaded at revision 0 with ` +
      '`artifactVersion` `builtin/1`. Every cell is an exact kind pair: a rule declares both ' +
      'kinds or it does not register, and `pnpm dispatch:no-wildcard` is the gate._',
  ].join('\n');
};

const replace = (readme: string, matrix: string): string => {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start < 0 || end < 0) throw new Error('README.md is missing the rule-matrix markers');
  return `${readme.slice(0, start + START.length)}\n\n${matrix}\n\n${readme.slice(end)}`;
};

const main = async (): Promise<void> => {
  const { readFile, writeFile } = await import('node:fs/promises');
  const path = new URL('../README.md', import.meta.url);
  const current = await readFile(path, 'utf8');
  const next = replace(current, renderMatrix(BUILTIN_DECLARATIONS));
  if (next !== current) await writeFile(path, next);
  console.log(`rule-matrix ok — ${BUILTIN_DECLARATIONS.length} declarations rendered`);
};

if (process.argv[1]?.endsWith('generate-rule-matrix.ts')) await main();