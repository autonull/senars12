/**
 * Scenario catalog — the single source of deterministic engine states the UI,
 * the E2E suite and the future gallery all load from. A scenario is data, so the
 * server endpoint, the Playwright fixture and (later) the demo runner address the
 * same definition instead of each hand-seeding its own beliefs.
 *
 * Loading goes through the real engine (`believe`/`goal` + `run`); nothing here
 * injects synthetic state. `bootstrap` is the default the agent test server uses.
 */
export type Scenario = {
  id: string;
  narrative: string;
  seed?: number;
  beliefs: string[];
  goals?: string[];
  /** Reasoning cycles after the statements are admitted. */
  runCycles?: number;
};

/** Minimal engine surface a scenario needs; NAR satisfies it structurally. */
export type ScenarioEngine = {
  believe?: (statement: string) => Promise<void>;
  goal?: (statement: string) => Promise<void>;
  run?: (cycles: number) => unknown;
};

const bootstrap: Scenario = {
  id: 'bootstrap',
  narrative: 'Foundational taxonomy beliefs that give the graph visible structure.',
  beliefs: [
    '<bird --> animal>.',
    '<robin --> bird>.',
    '<sky --> blue>.',
    '<cat --> mammal>.',
    '<dog --> mammal>.',
    '<fish --> animal>.',
  ],
  runCycles: 3,
};

export const SCENARIOS: Record<string, Scenario> = {
  bootstrap,
  'basic-derivation': {
    id: 'basic-derivation',
    narrative: 'S1: transitive deduction surfaces a robin-is-animal conclusion with provenance.',
    seed: 1,
    beliefs: ['<bird --> animal>.', '<robin --> bird>.'],
    runCycles: 5,
  },
  'conflicting-evidence': {
    id: 'conflicting-evidence',
    narrative: 'S2: two competing beliefs for one term force a visible revision history.',
    seed: 2,
    beliefs: ['<swan --> white>.', '<swan --> black>.'],
    runCycles: 5,
  },
};

export const scenarioById = (id: string): Scenario | undefined => SCENARIOS[id];

export const scenarioIds = (): string[] => Object.keys(SCENARIOS);

/** The default baseline scenario, typed as present (index access yields `| undefined`). */
export const BOOTSTRAP_SCENARIO: Scenario = bootstrap;

/** Admit a scenario's statements through the real engine, then reason. */
export async function loadScenario(engine: ScenarioEngine, scenario: Scenario): Promise<void> {
  for (const belief of scenario.beliefs) {
    await engine.believe?.(belief);
  }
  for (const goal of scenario.goals ?? []) {
    await engine.goal?.(goal);
  }
  engine.run?.(scenario.runCycles ?? 3);
}
