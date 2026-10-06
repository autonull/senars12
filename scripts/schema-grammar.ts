#!/usr/bin/env tsx
/**
 * `schema:grammar` — one spelling per value a boundary admits.
 *
 * Every schema in this system is a boundary: a gate IO, a persisted record, a config
 * read off disk, a tool argument from a model. Each had spelled its own fragments —
 * `z.string().min(1)` twenty-five times, `z.string().uuid()` eighteen,
 * `z.number().int().nonnegative()` twenty-nine, `z.number().int().positive()`
 * thirty-six, plus the bounded counts — and every spelling was correct. That is the
 * problem: a rule id that admits the empty string on one edge and refuses it on the
 * next is not a bug anyone finds locally, it is a boundary whose strictness is a
 * property of which file happened to declare the field. And a fragment spelled inline
 * cannot be widened once, because there is no once.
 *
 * The fragments live in `util/src/config/boundary.ts` — `nonEmpty`, `uuid`,
 * `nonNegativeInt`, `positiveInt`, `timestamp`, `intBetween`, `intAtLeast` — beside
 * the two intervals that were there first, under the name `scalars`, which stopped
 * being true the moment a string joined them. So the grammar belongs in a gate rather
 * than in review: the same argument as {@link env-grammar} and
 * {@link primitives-grammar}, over the one family those two do not cover.
 *
 * **The rule: production code reaches these values by name.** A site that must spell
 * the bound itself belongs in `DECLARED` below, with its reason.
 *
 * The patterns are deliberately narrow — each matches the shape that was actually
 * folded, not the general family — because a gate that cries wolf gets switched off,
 * and a switched-off gate is worse than no gate.
 *
 * They match against the file with every comment and string blanked and every space
 * removed, so a chain the formatter wrapped across five lines is the same match as one
 * it kept on one. A grammar that formatting could switch off would be a grammar with a
 * bypass: `z\n.number()\n.int()\n.positive()` is not a different expression, so it does
 * not get a different answer.
 */

import { maskNonCode } from './lib/imports.js';
import { scanSubject } from './lib/source-scan.js';

/** The sites that may spell a boundary fragment themselves, each with the reason. */
const DECLARED: readonly { readonly file: string; readonly reason: string }[] = [
  {
    file: 'util/src/config/boundary.ts',
    reason: 'the fragments themselves — this is where the vocabulary is defined',
  },
];

const declared = new Set(DECLARED.map((site) => site.file));

/**
 * The masked source with whitespace dropped, and the source line each surviving
 * character came from — so a report can name a line without the matcher having to
 * keep the wrapping.
 */
const squashed = (source: string): { text: string; lines: number[] } => {
  const masked = maskNonCode(source);
  let text = '';
  const lines: number[] = [];
  let line = 1;
  for (const ch of masked) {
    if (ch === '\n') line++;
    else if (!/\s/.test(ch)) {
      text += ch;
      lines.push(line);
    }
  }
  return { text, lines };
};

/**
 * One inline spelling and the fragment that already answers it.
 *
 * Ordered longest-first, because two of them are prefixes of one another:
 * `z.number().int().min(1).max(20)` is an `intBetween`, and the `intAtLeast` that
 * would also match it is the same bound spelled with the ceiling left off.
 */
const IDIOMS: readonly { readonly fragment: string; readonly pattern: RegExp }[] = [
  { fragment: 'nonEmpty', pattern: /z\.string\(\)\.min\(1\)/g },
  { fragment: 'uuid', pattern: /z\.string\(\)\.uuid\(\)|(?<![.\w])z\.uuid\(\)/g },
  { fragment: 'nonNegativeInt', pattern: /z\.number\(\)\.int\(\)\.nonnegative\(\)/g },
  { fragment: 'positiveInt', pattern: /z\.number\(\)\.int\(\)\.positive\(\)/g },
  { fragment: 'intBetween', pattern: /z\.number\(\)(?:\.int\(\))?\.min\(\d+\)\.max\(\d+\)/g },
  { fragment: 'intAtLeast', pattern: /z\.number\(\)\.int\(\)\.min\(\d+\)/g },
];

interface Violation {
  readonly at: string;
  readonly fragment: string;
  readonly text: string;
}

const subjects = scanSubject();

const violations = subjects
  .filter(({ path }) => !declared.has(path))
  .flatMap(({ path, source }) => {
    const { text, lines } = squashed(source);
    const claimed: [number, number][] = [];
    return IDIOMS.flatMap(({ fragment, pattern }) =>
      [...text.matchAll(pattern)]
        .filter((match) => {
          const at = match.index ?? 0;
          const end = at + match[0].length;
          if (claimed.some(([from, to]) => at < to && end > from)) return false;
          claimed.push([at, end]);
          return true;
        })
        .map((match) => ({
          at: `${path}:${lines[match.index ?? 0]}`,
          fragment,
          text: match[0],
        }))
    );
  });

if (violations.length > 0) {
  console.error('schema:grammar FAILED — a boundary fragment spelled inline:');
  for (const v of violations) console.error(`  ${v.at} — ${v.fragment} — ${v.text}`);
  console.error(
    '\n  Name it instead, from @senars/util/config:\n' +
      '    nonEmpty             a string with content\n' +
      '    uuid                 a minted identifier (makeId mints these)\n' +
      '    nonNegativeInt       a count that may be zero\n' +
      '    positiveInt          a count that may not be zero\n' +
      '    timestamp            wall-clock milliseconds\n' +
      '    intBetween(lo, hi)   a count bounded above as well\n' +
      '    intAtLeast(lo)       a count with a floor the caller chose\n' +
      '  A site that must spell the bound itself belongs in DECLARED above, with its reason.'
  );
  process.exit(1);
}

console.log(
  `schema:grammar ok — ${subjects.length} production files reach ${IDIOMS.length} boundary ` +
    `fragments by name, with ${DECLARED.length} declared site(s)`
);
