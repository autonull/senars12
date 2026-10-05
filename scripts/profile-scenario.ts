#!/usr/bin/env tsx
/**
 * Profile a golden scenario with more cycles to identify hot paths for C3.
 * Run with: node --cpu-prof --import=tsx scripts/profile-scenario.ts
 */

import { runScenario, createScenarioSpec } from '../tests/e2e/harness.js';

const profileScenario = createScenarioSpec({
  name: 'profile-belief-derivation-ask',
  seed: 42,
  clockStart: 1000000,
  steps: [
    { type: 'input', text: '(cat --> animal).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(animal --> living).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(bird --> animal).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(fish --> animal).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'input', text: '(dog --> animal).', taskType: 'belief', truth: { f: 0.9, c: 0.9 } },
    { type: 'run', cycles: 1000 }, // Many more cycles for profiling
    { type: 'input', text: '(cat --> living)?', taskType: 'question' },
    { type: 'run', cycles: 1000 },
    {
      type: 'assert',
      check: (trace) => {
        if (trace.cycleCount < 1) {
          throw new Error('Expected at least 1 cycle');
        }
      },
    },
  ],
});

async function main() {
  console.log('Running profile scenario...');
  const result = await runScenario(profileScenario);
  console.log(
    `Completed: ${result.trace.cycleCount} cycles, ${result.trace.derivations.length} derivations`
  );
  console.log(`State hash: ${result.trace.stateHash}`);
  console.log(`Tasks: ${result.trace.tasks.length}`);
  console.log(`Budget events: ${result.trace.budgetEvents.length}`);
  console.log(`Adaptations: ${result.trace.adaptations.length}`);
}

main().catch(console.error);
