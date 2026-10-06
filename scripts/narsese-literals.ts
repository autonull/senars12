#!/usr/bin/env tsx

/**
 * `narsese:literals` — every Narsese string literal under `nar/src`, `src/`,
 * `scripts/`, `examples/` parses **and** re-serialises to itself.
 *
 * This is the gate for TODO30 §2.3 T3. The legacy `<...>` form is deprecated
 * upstream (`docs/java/Op.java`: `@Deprecated OLD_STATEMENT_OPENER='<'`) and
 * cannot nest (`<<a-->b>>` is a parse failure). The canonical form uses `()`.
 *
 * Only validates actual string literals (single/double quoted) that represent
 * complete Narsese terms or tasks — not template strings, not compound rule
 * patterns, not operator symbol definitions.
 *
 * This file is the process boundary. The rule and its verdicts live in
 * `scripts/lib/narsese-literals.ts` so a test can call the gate and prove it can
 * fail — §10.1's rule, which `scripts/terms-canonical.ts` states and this gate
 * had been quietly violating by keeping its only logic inline.
 *
 * **It reads `parseTask`, not `parse`.** A literal like `(robin --> bird).` is a
 * *task*: the trailing `.` is what makes it a judgment, and it is not part of a
 * `Term` at all. The gate was handing task literals to a term parser and a term
 * serialiser, which cannot represent the mark, so every literal with a judgment
 * mark was guaranteed to fail — the gate was asserting a property the types made
 * impossible rather than reporting one. `parseTask` keeps the punctuation and the
 * truth, so the round trip it checks is the round trip that actually happens.
 *
 * **"Itself" means up to insignificant whitespace.** Whitespace is only
 * insignificant *between* a word character and a non-word one — around a copula,
 * inside brackets — and significant between two word characters, so `[long cat]`
 * stays one atom and never becomes `[longcat]`. A gate that compared raw strings
 * was not asking whether a literal round-trips; it was asking whether the author
 * had omitted the author's spaces. That is not a property of Narsese, and it had
 * gone red on a worked example written the way the README writes them.
 *
 * The structural property — that the serialiser is a fixed point — is checked
 * separately and is not optional, because that one *is* a real defect when it
 * fails: a serialiser that changes its own output on a second pass is one whose
 * round trip a downstream reader cannot rely on.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { roundTrip } from './lib/narsese-literals.js';
import { ROOT } from './lib/root.js';
import { lineAt } from './lib/source-scan.js';

const TARGET_DIRS = ['nar/src', 'src', 'scripts', 'examples'];
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

// Files to exclude from literal checking (they contain generated output, markdown, templates, etc.)
const EXCLUDE_FILES = new Set([
  'scripts/arcade-replay.ts',
  'scripts/control-budgets.ts',
  'scripts/fundamentals-bench.ts',
  'scripts/fuzz-narsese.ts',
  'scripts/lib/attention-surface.ts',
  'scripts/lib/dispatch-table.ts',
  'scripts/lib/proposal-protocol.ts',
  'scripts/lib/terms-canonical.ts',
  'scripts/narsese-literals.ts',
  'scripts/profile-scenario.ts',
  'scripts/relevance-measured.ts',
  'scripts/resource-policy.ts',
  'scripts/terms-no-bool-task.ts',
  'scripts/answer-no-fabrication.ts',
  'scripts/cycle-no-provider.ts',
  'src/bin/commands/connection.ts',
  'src/bin/commands/lm.ts',
  'src/bin/commands/profile.ts',
  'src/bin/lib/doctor-report.ts',
  'nar/src/learning/schema-induction.ts', // rule pattern templates
  'nar/src/nl/normalize.ts', // operator symbols, patterns
  'nar/src/nl/prompts/understanding-v1.ts', // prompt templates
  'nar/src/rules/impls/meta-rules.ts', // rule templates with variables
  'nar/src/tools/impls/self-concept.ts', // belief templates
  'nar/src/tools/adapters/scenario-execute.ts', // scenario templates
  'nar/src/tools/adapters/aisdk-adapter.ts', // example literals
  'nar/src/imagination/impls/CognitiveTreadmill.ts', // test fixtures
  'nar/src/imagination/impls/ScenarioGenerator.ts', // test fixtures
  'nar/src/imagination/impls/HiddenModelOracle.ts', // test data
  'nar/src/agent/cognitive-agent.ts', // test fixtures
  'nar/src/lm/rule-builders.ts', // rule builder examples
]);

// Match single/double quoted string literals that look like complete Narsese terms/tasks
// - Not template literals (backticks)
// - No template interpolation ${...}
// - No template variables $identifier
// - Single term/task (not compound with & or ==> at top level)
// - Start with ( and contain a copula, end with ) + optional punctuation/truth
const STRING_LITERAL_PATTERN =
  /(["'])((?:\((?:(?!\1|[$&]).)*?(?:-->|<->|==>|<=>|=\/>|=&\||&|\\||&\/|\^)(?:(?!\1|[$&]).)*?\))[.!?@;]?(?:%[^%]*%)?)\1/g;

// Legacy syntax pattern: <...> with complete statement inside
const LEGACY_PATTERN =
  /(["'])((?:<\((?:(?!\1|[$&]).)*?(?:-->|<->|==>|<=>|=\/>|=&\||&|\\||&\/|\^)(?:(?!\1|[$&]).)*?\)>)[.!?@;]?(?:%[^%]*%)?)\1/g;

function walkDir(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          files.push(...walkDir(full));
        }
      } else if (EXTENSIONS.includes(extname(entry.name))) {
        files.push(full);
      }
    }
  } catch {
    // Directory might not exist
  }
  return files;
}

function shouldExclude(file: string): boolean {
  const rel = relative(ROOT, file);
  return EXCLUDE_FILES.has(rel);
}

function extractNarseseLiterals(
  content: string
): { literal: string; quote: string; index: number }[] {
  const results: { literal: string; quote: string; index: number }[] = [];
  const matches = content.matchAll(STRING_LITERAL_PATTERN);
  for (const match of matches) {
    const literal = match[2];
    const quote = match[1];
    const index = match.index ?? 0;
    // Skip if it contains template interpolation or variables
    if (literal.includes('${') || /\$\w+/.test(literal)) continue;
    // Skip if it looks like a fragment (contains ...)
    if (literal.includes('...')) continue;
    results.push({ literal, quote, index });
  }
  return results;
}

function extractLegacyLiterals(
  content: string
): { literal: string; quote: string; index: number }[] {
  const results: { literal: string; quote: string; index: number }[] = [];
  const matches = content.matchAll(LEGACY_PATTERN);
  for (const match of matches) {
    const literal = match[2];
    const quote = match[1];
    const index = match.index ?? 0;
    if (literal.includes('${') || /\$\w+/.test(literal)) continue;
    if (literal.includes('...')) continue;
    results.push({ literal, quote, index });
  }
  return results;
}

async function main() {
  let totalLiterals = 0;
  let failedLiterals = 0;
  let legacyFound = 0;
  const failures: string[] = [];
  const legacyFailures: string[] = [];

  for (const targetDir of TARGET_DIRS) {
    const dirPath = join(ROOT, targetDir);
    const files = walkDir(dirPath);

    for (const file of files) {
      if (shouldExclude(file)) continue;

      const content = readFileSync(file, 'utf8');

      // Check for legacy syntax
      const legacyLiterals = extractLegacyLiterals(content);
      for (const { literal, quote, index } of legacyLiterals) {
        legacyFound++;
        const relPath = relative(ROOT, file);
        legacyFailures.push(`${relPath}:${lineAt(content, index)} — legacy syntax '${literal}'`);
      }

      // Check round-trip for canonical syntax
      const literals = extractNarseseLiterals(content);
      for (const { literal, index } of literals) {
        totalLiterals++;
        const verdict = roundTrip(literal);
        if (verdict.failure) {
          failedLiterals++;
          failures.push(
            `${relative(ROOT, file)}:${lineAt(content, index)} — ${verdict.failure}`
          );
        }
      }
    }
  }

  let hasErrors = false;

  if (legacyFound > 0) {
    hasErrors = true;
    console.error(`narsese:literals — ${legacyFound} legacy <...> syntax literal(s) found`);
    for (const failure of legacyFailures) {
      console.error(`  ${failure}`);
    }
  }

  if (failures.length > 0) {
    hasErrors = true;
    console.error(
      `narsese:literals — ${failedLiterals}/${totalLiterals} literal(s) failed round-trip`
    );
    for (const failure of failures) {
      console.error(`  ${failure}`);
    }
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`narsese:literals — ${totalLiterals} Narsese literal(s) round-trip; 0 legacy syntax`);
}

main().catch((e) => {
  console.error('narsese:literals failed:', e);
  process.exit(1);
});
