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
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { termParser } from '../nar/src/terms/index.js';
import { serializeTerm } from '../nar/src/terms/impls/serialize.js';

const ROOT = process.cwd();
const TARGET_DIRS = ['nar/src', 'src', 'scripts', 'examples'];
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

// Files to exclude from literal checking (they contain generated output, markdown, templates, etc.)
const EXCLUDE_FILES = new Set([
  'scripts/arcade-replay.ts',
  'scripts/control-budgets.ts',
  'scripts/fundamentals-bench.ts',
  'scripts/fuzz-narsese.ts',
  'scripts/generate-rule-matrix.ts',
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
  'nar/src/learning/schema-induction.ts',  // rule pattern templates
  'nar/src/nl/normalize.ts',               // operator symbols, patterns
  'nar/src/nl/prompts/understanding-v1.ts', // prompt templates
  'nar/src/rules/impls/meta-rules.ts',      // rule templates with variables
  'nar/src/tools/impls/self-concept.ts',    // belief templates
  'nar/src/tools/adapters/scenario-execute.ts', // scenario templates
  'nar/src/tools/adapters/aisdk-adapter.ts',    // example literals
  'nar/src/imagination/impls/CognitiveTreadmill.ts', // test fixtures
  'nar/src/imagination/impls/ScenarioGenerator.ts', // test fixtures
  'nar/src/imagination/impls/HiddenModelOracle.ts', // test data
  'nar/src/agent/cognitive-agent.ts',       // test fixtures
  'nar/src/lm/rule-builders.ts',            // rule builder examples
]);

// Match single/double quoted string literals that look like complete Narsese terms/tasks
// - Not template literals (backticks)
// - No template interpolation ${...}
// - No template variables $identifier
// - Single term/task (not compound with & or ==> at top level)
// - Start with ( and contain a copula, end with ) + optional punctuation/truth
const STRING_LITERAL_PATTERN = /(["'])((?:\((?:(?!\1|[\$&]).)*?(?:-->|<->|==>|<=>|=\/>|=&\||&|\\||&\/|\^)(?:(?!\1|[\$&]).)*?\))[.!?@;]?(?:%[^%]*%)?)\1/g;

// Legacy syntax pattern: <...> with complete statement inside
const LEGACY_PATTERN = /(["'])((?:<\((?:(?!\1|[\$&]).)*?(?:-->|<->|==>|<=>|=\/>|=&\||&|\\||&\/|\^)(?:(?!\1|[\$&]).)*?\)>)[.!?@;]?(?:%[^%]*%)?)\1/g;

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

function extractNarseseLiterals(content: string): { literal: string; quote: string; index: number }[] {
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

function extractLegacyLiterals(content: string): { literal: string; quote: string; index: number }[] {
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
        legacyFailures.push(`${relPath}:${index} — legacy syntax '${literal}'`);
      }

      // Check round-trip for canonical syntax
      const literals = extractNarseseLiterals(content);
      for (const { literal, quote, index } of literals) {
        totalLiterals++;
        try {
          const parsed = termParser.parse(literal);
          const reserialized = serializeTerm(parsed);
          if (reserialized !== literal) {
            failedLiterals++;
            const relPath = relative(ROOT, file);
            failures.push(`${relPath}:${index} — '${literal}' re-serialises as '${reserialized}'`);
          }
        } catch (e) {
          failedLiterals++;
          const relPath = relative(ROOT, file);
          failures.push(`${relPath}:${index} — '${literal}' parse failed: ${e instanceof Error ? e.message : String(e)}`);
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
    console.error(`narsese:literals — ${failedLiterals}/${totalLiterals} literal(s) failed round-trip`);
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