#!/usr/bin/env tsx
/**
 * Consolidated Gates — runs grouped gate checks.
 *
 * Replaces 45+ individual gates with ~8 consolidated gates + preservation.
 * Groups:
 *   1. check — typecheck, lint, grammar, deps (static analysis)
 *   2. architecture — import:boundary, one:oracle, core:no-lm, memory:ports,
 *      attention:write-surface, proposal:protocol, dispatch:no-wildcard,
 *      rules:loaded-data, control-budgets, replay:proposal, resource:policy,
 *      cycle:no-provider, rule:has-fallback, gates:one-cycle-path,
 *      induction:inventory, config:model-matrix
 *   3. terms — terms:canonical, answer:no-fabrication, relevance:measured,
 *      terms:no-bool-task, narsese:literals
 *   4. exports — exports:audit, exports:check, exports:barrels
 *   5. e2e — e2e:pipeline, persistence:replay, derivation:verifiable,
 *      reward:policy-only, derivation:clean, egress:invariant
 *   6. legacy — no-new-legacy, surface-no-legacy
 *   7. schema — schema:drift, generated:artifacts, docs:drift
 *   8. tests — test:unit, test:determinism, test:hermetic, test:load-sensitive
 *   9. capability — capability:gate (preservation gate)
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/root.js';

interface GateGroup {
  name: string;
  scripts: string[];
  description: string;
}

const GATE_GROUPS: GateGroup[] = [
  {
    name: 'check',
    scripts: ['typecheck', 'lint', 'env:grammar', 'primitives:grammar', 'schema:grammar', 'deps:gate', 'deps:direction'],
    description: 'Static analysis: types, lint, grammars, dependencies',
  },
  {
    name: 'architecture',
    scripts: [
      'import:boundary', 'one:oracle', 'core:no-lm', 'memory:ports',
      'attention:write-surface', 'proposal:protocol', 'dispatch:no-wildcard',
      'rules:loaded-data', 'control-budgets', 'replay:proposal', 'resource:policy',
      'cycle:no-provider', 'rule:has-fallback', 'gates:one-cycle-path',
      'induction:inventory', 'config:model-matrix'
    ],
    description: 'Core architecture invariants',
  },
  {
    name: 'terms',
    scripts: ['terms:canonical', 'answer:no-fabrication', 'relevance:measured', 'terms:no-bool-task', 'narsese:literals'],
    description: 'Term system invariants',
  },
  {
    name: 'exports',
    scripts: ['exports:audit', 'exports:check', 'exports:barrels'],
    description: 'Export/barrel audits',
  },
  {
    name: 'e2e',
    scripts: ['e2e:pipeline', 'persistence:replay', 'derivation:verifiable', 'reward:policy-only', 'derivation:clean', 'egress:invariant'],
    description: 'End-to-end integration milestones',
  },
  {
    name: 'legacy',
    scripts: ['no-new-legacy', 'surface-no-legacy'],
    description: 'Legacy package freeze gates',
  },
  {
    name: 'schema',
    scripts: ['schema:drift', 'generated:artifacts', 'docs:drift'],
    description: 'Schema drift and generated artifacts',
  },
  {
    name: 'tests',
    scripts: ['test:unit', 'test:determinism', 'test:hermetic', 'test:load-sensitive'],
    description: 'Test suites (unit, determinism, hermetic, load-sensitive)',
  },
  {
    name: 'capability',
    scripts: ['capability:gate'],
    description: 'Capability preservation gate',
  },
];

function runScript(script: string): { success: boolean; output: string } {
  const result = spawnSync('pnpm', ['run', script], {
    cwd: ROOT,
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
  return {
    success: result.status === 0,
    output: result.stdout?.toString() ?? result.stderr?.toString() ?? '',
  };
}

function runGroup(group: GateGroup): boolean {
  console.log(`\n🔍 Running gate group: ${group.name}`);
  console.log(`   ${group.description}`);
  console.log(`   Scripts: ${group.scripts.join(', ')}`);

  let allPassed = true;
  for (const script of group.scripts) {
    // Check if script exists in package.json
    const pkgPath = join(ROOT, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (!pkg.scripts?.[script]) {
      console.log(`   ⚠️  ${script}: not found in package.json, skipping`);
      continue;
    }

    process.stdout.write(`   ▶ ${script}... `);
    const result = runScript(script);
    if (result.success) {
      console.log('✅');
    } else {
      console.log('❌');
      console.log(`      ${result.output.split('\n').slice(0, 3).join('\n      ')}`);
      allPassed = false;
    }
  }

  return allPassed;
}

function main() {
  const args = process.argv.slice(2);
  const targetGroup = args[0];

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          CONSOLIDATED GATES — ~8 + preservation              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  let allPassed = true;

  if (targetGroup) {
    const group = GATE_GROUPS.find(g => g.name === targetGroup);
    if (!group) {
      console.error(`Unknown gate group: ${targetGroup}`);
      console.error(`Available groups: ${GATE_GROUPS.map(g => g.name).join(', ')}`);
      process.exit(1);
    }
    allPassed = runGroup(group);
  } else {
    // Run all groups
    for (const group of GATE_GROUPS) {
      const passed = runGroup(group);
      allPassed = allPassed && passed;
    }
  }

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  if (allPassed) {
    console.log('║  ✅ ALL GATE GROUPS PASSED                                    ║');
  } else {
    console.log('║  ❌ SOME GATE GROUPS FAILED                                   ║');
  }
  console.log('╚══════════════════════════════════════════════════════════════╝');

  process.exit(allPassed ? 0 : 1);
}

main();