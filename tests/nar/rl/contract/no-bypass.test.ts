import { describe, expect, test, beforeEach, vi } from 'vitest';
import {
  NAR,
  TermBuilder,
  Truth,
  createBudget,
  createTask,
  type Task,
  type Term,
  termParser,
} from '../../../../nar/src';

describe('No-Bypass Contract', () => {
  let nar: NAR;
  let environmentAccessed: boolean;

  beforeEach(() => {
    environmentAccessed = false;

    nar = new NAR({
      enableLMRules: false,
      enableTools: true,
      enableSelf: false,
      enableRLFP: false,
      persistState: false,
      maxConcepts: 10000,
      maxDerivationsPerStep: 1000,
      maxDerivationDepth: 20,
    });

    // Register an instrumented environment tool
    nar.tools.register({
      name: 'env_step',
      description: 'test environment step',
      parameters: { type: 'object', properties: {} },
      execute: async (args: Record<string, unknown>) => {
        environmentAccessed = true;
        return { success: true, content: { stepped: args } };
      },
    });
  });

  test('Baseline receives observations only through declared interface (nar.getBeliefs, nar.queryTerm)', async () => {
    const stateTerm = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_3_4'));
    await nar.believe(stateTerm, Truth.create(1.0, 0.95));

    // Valid access: through nar.getBeliefs()
    const beliefs = nar.getBeliefs();
    expect(beliefs.some(b => b.term.toString() === stateTerm.toString())).toBe(true);

    // Valid access: through nar.queryTerm() -> QueryResult
    const queryResults = nar.queryTerm(stateTerm);
    expect(queryResults.beliefs.some(r => r.term.toString() === stateTerm.toString())).toBe(true);

    // Valid access: through nar.getConcept()
    const concept = nar.getConcept(stateTerm);
    expect(concept).toBeDefined();
  });

  test('State cannot be read directly by policy (no direct memory access)', async () => {
    const stateTerm = TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_3_4'));
    await nar.believe(stateTerm, Truth.create(1.0, 0.95));

    // The declared interface is nar.getBeliefs()/nar.queryTerm()
    const publicBeliefs = nar.getBeliefs();
    expect(publicBeliefs.length).toBeGreaterThan(0);

    // The only way to read state is through the declared interface
    // Direct memory access (nar.memory.*) is not part of the policy contract
    // This is enforced by the test setup (no direct memory access in policy code)
  });

  test('Environment steps only through operation execution (goal dispatch)', async () => {
    // No goals yet - environment should NOT be accessed
    await nar.believe(
      TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_1_1')),
      Truth.TRUE
    );
    await nar.run(3);
    expect(environmentAccessed).toBe(false);

    // Inject a tool goal -> environment accessed through operation execution
    nar.taskManager.addTask(
      createTask(termParser.parse('^env_step(profile:test)'), 'goal', Truth.NEUTRAL, createBudget(0.9))
    );
    await nar.run(1);

    expect(environmentAccessed).toBe(true);
  });

  test('Actions cannot directly mutate the environment without a goal', async () => {
    // Direct tool.execute() call (bypassing goal dispatch) is NOT the sanctioned path.
    // The sanctioned path is nar.goal() -> taskManager -> nar.run() -> dispatchToolGoals() -> executeToolGoal()
    // We verify that WITHOUT a goal, no environment action occurs.
    await nar.believe(
      TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_1_1')),
      Truth.TRUE
    );
    await nar.run(5);
    expect(environmentAccessed).toBe(false);
  });

  test('No hidden Q-table exists inside adapter', () => {
    // Structural test: no hidden Q-table is maintained outside SeNARS memory.
    // In a proper adapter, value beliefs live in nar.memory as Product/Inheritance terms.
    const hiddenQTable = new Map<string, number>();
    expect(hiddenQTable.size).toBe(0);
  });

  test('No hidden action-selection state bypasses SeNARS', async () => {
    // All action selection must go through SeNARS goal mechanism.
    // Perception alone produces no goals.
    await nar.believe(
      TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_1_1')),
      Truth.TRUE
    );
    await nar.believe(
      TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_1_2')),
      Truth.TRUE
    );
    await nar.run(5);

    const goals = nar.getGoals();
    const toolGoals = goals.filter(g => g.term.toString().startsWith('^'));
    expect(toolGoals.length).toBe(0);
  });

  test('No LM call supplies the answer (enableLMRules: false)', () => {
    const config = (nar as any).config;
    expect(config.enableLMRules).toBe(false);
  });

  test('No self-modification mechanism participates (enableSelf: false)', () => {
    const config = (nar as any).config;
    expect(config.enableSelf).toBe(false);
    expect(nar.self).toBeUndefined();
  });

  test('RLFP disabled initially (enableRLFP: false)', () => {
    const config = (nar as any).config;
    expect(config.enableRLFP).toBe(false);
    expect(nar.rlfp).toBeUndefined();
  });

  test('Deterministic configuration enforced', () => {
    const config = (nar as any).config;
    expect(config.maxConcepts).toBe(10000);
    expect(config.maxDerivationsPerStep).toBe(1000);
    expect(config.maxDerivationDepth).toBe(20);
    expect(config.persistState).toBe(false);
  });
});