#!/usr/bin/env tsx
/**
 * `env:grammar` — one way to read the environment, so a boolean is a boolean
 * everywhere and a blank var is an absent one everywhere.
 *
 * `process.env` has four spellings per key at a call site and each one answers a
 * different question. `envStr` treats `KEY=` as absent, `envBool` accepts
 * `1/yes/on` and their complements and rejects everything else, `envNumOr`
 * refuses `NaN`/`Infinity`. Raw `process.env` has none of that: `if
 * (process.env.CI)` reads `CI=false` as *true*, `Boolean(process.env.LM_API_KEY)`
 * reports a credential that does not exist, and `envValue || default` drops an
 * explicit empty while `?? default` keeps it. None of those disagreements is a
 * bug anyone can see locally — they are only visible as two features configured
 * differently from the same environment — so the grammar belongs in a gate
 * rather than in review.
 *
 * **The rule: production code names the environment only through
 * `@senars/util/config`'s accessors.** `process.env` is unreachable from
 * `src/`, `core/`, `nar/`, `io/`, `metta/`, `util/` and `ui/` except at the
 * declared sites below, each of which reads or writes the raw table on purpose.
 *
 * The declared set is a ledger with reasons rather than a file-name exemption, so
 * a new raw read is a decision somebody has to write down, and an empty ledger
 * would be suspicious rather than clean.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { lineAt, sourceFiles } from './lib/source-scan.js';
import { ROOT } from './lib/root.js';

const SOURCE_ROOTS = ['src', 'core/src', 'nar/src', 'io/src', 'metta/src', 'util/src', 'ui/src'];

/**
 * Sites allowed to touch `process.env` itself, each with the reason. Three
 * kinds, and only three: the accessors, a census, and a CLI that installs an
 * override in-process.
 */
const RAW_ENV_SITES: readonly { readonly file: string; readonly reason: string }[] = [
  {
    file: 'util/src/config/env.ts',
    reason: 'the accessors themselves — this is where the grammar is defined',
  },
  {
    file: 'src/utils/env-validate.ts',
    reason: 'census: the validator must enumerate the whole table to report unknown vars',
  },
  {
    file: 'src/bin/commands/lm.ts',
    reason: '`.lm use <provider> <model>` installs the override the accessors then read',
  },
];

/** A raw read that is neither a declaration nor a comment/prose mention. */
const RAW_ENV = /(?<![.\w$])process\s*\.\s*env\b(?![\w$])/g;

export interface RawEnvRead {
  readonly at: string;
  readonly text: string;
}

const sources = (): string[] =>
  SOURCE_ROOTS.flatMap((root) => sourceFiles(join(ROOT, root))).filter((file) =>
    file.endsWith('.ts')
  );

const reads = (source: string, file: string): RawEnvRead[] => {
  const lines = source.split('\n');
  const found: RawEnvRead[] = [];
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    // A mention in prose is documentation of the grammar, not a read of it.
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) continue;
    for (const match of line.matchAll(RAW_ENV)) {
      found.push({ at: `${relative(ROOT, file)}:${index + 1}`, text: trimmed });
    }
  }
  return found;
};

const declared = new Set(RAW_ENV_SITES.map((site) => join(ROOT, site.file)));

const violations = sources().flatMap((file) => {
  if (declared.has(file)) return [];
  return reads(readFileSync(file, 'utf-8'), file);
});

if (violations.length > 0) {
  console.error('env:grammar FAILED — production code reads process.env directly:');
  for (const v of violations) console.error(`  ${v.at} — ${v.text}`);
  console.error(
    '\n  Read through @senars/util/config instead:\n' +
      '    envStr(...)        a value, treating an empty var as absent\n' +
      '    envStrOr(f, ...)   a value with a fallback\n' +
      '    envSet(...)        "is this configured?"\n' +
      '    envBool(k, false)  the boolean grammar: 1/yes/on vs 0/no/off, anything else false\n' +
      '    envInt / envNum / envPositive(key, n)   numbers that reject NaN and Infinity\n' +
      '    envCsv(fallback, ...)                  comma-separated lists\n' +
      '  A key the caller may not have is spelled `envStr(maybeKey, ...)` — absent keys are skipped,\n' +
      '  which is what `apiKeyEnv ? process.env[apiKeyEnv] : undefined` was hand-writing.\n' +
      '  A site that must read the raw table belongs in RAW_ENV_SITES above, with its reason.'
  );
  process.exit(1);
}

const files = sources().length;
console.log(
  `env:grammar ok — ${files} production files name the environment only through ` +
    `${RAW_ENV_SITES.length} declared accessor/enumeration/write site(s)`
);
