#!/usr/bin/env tsx
/**
 * Generated artifacts gate: fails if any generated artifact is not reproducible from the genome.
 *
 * This gate runs the genome and verifies that all expected output files are produced
 * and have valid content. It does not compare to committed files (schema:drift does that);
 * it verifies the genome produces a complete, well-formed artifact set.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/core/root.ts';

const GENOME_SCRIPT = join(ROOT, 'src/formats/genome/index.ts');
const GEN_DIR = join(ROOT, 'src/generated');

const EXPECTED_FILES = [
  'schemas.ts',
  'json-schema/index.json',
  'json-schema/egress_gates.json',
  'json-schema/stamp_types.json',
  'json-schema/shadow_sources.json',
  'json-schema/health_statuses.json',
  'json-schema/conflict_types.json',
  'json-schema/kernel_control_states.json',
  'json-schema/activation_sources.json',
  'json-schema/governance_decided_by.json',
  'json-schema/governance_decisions.json',
  'json-schema/governance_actions.json',
  'json-schema/self_improvement_kinds.json',
  'json-schema/severity_levels.json',
  'json-schema/violation_types.json',
  'json-schema/reward_target_types.json',
  'json-schema/reward_types.json',
  'json-schema/gate_names.json',
  'json-schema/budget_operations.json',
  'json-schema/termination_reasons.json',
];

function runGenome(): void {
  const result = spawnSync('tsx', [GENOME_SCRIPT], { cwd: ROOT, stdio: 'pipe' });
  if (result.status !== 0) {
    console.error('generated:artifacts FAILED — genome generation errored:');
    console.error(result.stderr?.toString() ?? 'unknown error');
    process.exit(1);
  }
}

function verifyOutput(): string[] {
  const errors: string[] = [];

  for (const rel of EXPECTED_FILES) {
    const path = join(GEN_DIR, rel);
    if (!existsSync(path)) {
      errors.push(`missing: ${rel}`);
      continue;
    }
    const content = readFileSync(path, 'utf-8');
    if (!content.trim()) {
      errors.push(`empty: ${rel}`);
      continue;
    }
    if (rel.endsWith('.json')) {
      try {
        JSON.parse(content);
      } catch (e) {
        errors.push(`invalid JSON: ${rel} — ${e}`);
      }
    }
  }

  return errors;
}

try {
  runGenome();
  const errors = verifyOutput();

  if (errors.length > 0) {
    console.error('generated:artifacts FAILED — genome output incomplete or invalid:');
    for (const err of errors) {
      console.error(`  ${err}`);
    }
    process.exit(1);
  }

  console.log('generated:artifacts ok — genome produces all expected artifacts');
} catch (err) {
  console.error(`generated:artifacts ERROR — ${err}`);
  process.exit(1);
}