import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createNAR, termKey, Truth, TermBuilder } from '../../../nar/src';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createSeNARSRegistry } from '../../../nar/src/lm';
import { createLMService } from '../../../nar/src/lm/lm-service';

const testStateDir = join(process.cwd(), '.cache', 'test-restart-equivalence');

function committedStateKey(nar: ReturnType<typeof createNAR>): {
  beliefs: Set<string>;
  goals: Set<string>;
  questions: Set<string>;
} {
  const beliefs = new Set<string>();
  const goals = new Set<string>();
  const questions = new Set<string>();

  for (const belief of nar.getBeliefs()) {
    beliefs.add(termKey(belief.term));
  }
  for (const goal of nar.getGoals()) {
    goals.add(termKey(goal.term));
  }
  for (const question of nar.getQuestions()) {
    questions.add(termKey(question.term));
  }

  return { beliefs, goals, questions };
}

describe('M4: Crash/Recovery — Restart Equivalence', () => {
  beforeEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
    await mkdir(testStateDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testStateDir, { recursive: true, force: true });
  });

  test('restart with persisted state reconstructs identical committed state', async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    // NAR 1: create, add beliefs, run cycles, stop (saves state)
    const nar1 = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: true,
      statePath: testStateDir,
      maxConcepts: 1000,
    });

    await nar1.start();

    // Add some beliefs with known terms
    await nar1.believe('(cat --> animal).');
    await nar1.believe('(dog --> animal).');
    await nar1.believe('(bird --> animal).');
    await nar1.goal('(cat --> pet)!');
    await nar1.question('(whiskers --> ?what)?');

    // Run enough cycles for derivations to occur and state to be saved
    await nar1.run(10);

    // Capture committed state before stopping
    const state1 = committedStateKey(nar1);

    // Stop NAR 1 (triggers persist)
    await nar1.stop();
    await nar1.dispose();

    // NAR 2: create new instance with same statePath, start (loads state)
    const nar2 = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: true,
      statePath: testStateDir,
      maxConcepts: 1000,
    });

    await nar2.start();

    // Capture committed state after loading
    const state2 = committedStateKey(nar2);

    // Verify identical committed state
    expect(state2.beliefs).toEqual(state1.beliefs);
    expect(state2.goals).toEqual(state1.goals);
    expect(state2.questions).toEqual(state1.questions);

    await nar2.stop();
    await nar2.dispose();
  });

  test('restart at capacity stresses eviction and archive paths', async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    const nar1 = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: true,
      statePath: testStateDir,
      maxConcepts: 50, // small capacity to trigger eviction
    });

    await nar1.start();

    // Fill memory beyond capacity to trigger eviction
    for (let i = 0; i < 80; i++) {
      await nar1.believe(`(concept_${i} --> category).`, Truth.create(0.8, 0.7));
    }

    await nar1.run(20); // let eviction/archive happen
    await nar1.stop();
    await nar1.dispose();

    // Restart and verify state loads without corruption
    const nar2 = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: true,
      statePath: testStateDir,
      maxConcepts: 50,
    });

    await nar2.start();

    const state2 = committedStateKey(nar2);

    // Should have some beliefs restored (exact count depends on eviction)
    expect(state2.beliefs.size).toBeGreaterThan(0);
    expect(state2.beliefs.size).toBeLessThanOrEqual(50);

    await nar2.stop();
    await nar2.dispose();
  });

  test('restart with maxTasks pressure', async () => {
    const registry = createSeNARSRegistry();
    const lmService = createLMService();

    const nar1 = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: true,
      statePath: testStateDir,
      maxConcepts: 100,
    });

    await nar1.start();

    // Add a concept with many tasks to trigger task pressure
    for (let i = 0; i < 15; i++) {
      await nar1.believe(`(pressure_test --> item_${i}).`, Truth.create(0.7, 0.6));
    }

    await nar1.run(15);
    await nar1.stop();
    await nar1.dispose();

    const nar2 = createNAR({
      providerRegistry: registry,
      lmService,
      persistState: true,
      statePath: testStateDir,
      maxConcepts: 100,
    });

    await nar2.start();

    const state2 = committedStateKey(nar2);

    // Should have tasks restored within the per-concept limit
    expect(state2.beliefs.size).toBeGreaterThan(0);

    await nar2.stop();
    await nar2.dispose();
  });
});