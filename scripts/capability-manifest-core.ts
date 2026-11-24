/**
 * Capability Manifest — behavior-level capability registry with preservation gate.
 *
 * Each entry = a user-facing behavior with an owner and a behavioral test.
 * Not raw exports. This is the safety net for all later work.
 */

import type { FacultySpec } from '../src/faculties/specs.js';
import type { OracleOperation } from '../src/oracles/oracle.js';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

/** Capability categories aligned with faculty categories. */
export const CAPABILITY_CATEGORIES = [
  'perception',
  'inference',
  'learning',
  'reasoning',
  'planning',
  'evaluation',
  'communication',
  'governance',
  'memory',
  'coordination',
  'games',
  'rl',
  'analysis',
  'self-mod',
  'focus',
  'nl',
  'schema',
  'transport',
  'mining',
] as const;

export type CapabilityCategory = (typeof CAPABILITY_CATEGORIES)[number];

/** A behavioral test reference. */
export interface BehavioralTest {
  /** Test file path relative to repo root. */
  path: string;
  /** Test suite name (describe block). */
  suite: string;
  /** Test case name (it block). */
  case: string;
  /** What behavior this test verifies. */
  verifies: string;
}

/** Capability manifest entry. */
export interface CapabilityManifestEntry {
  /** Unique capability ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Category. */
  category: CapabilityCategory;
  /** Owner (team/individual). */
  owner: string;
  /** Description of the user-facing behavior. */
  behavior: string;
  /** Behavioral tests that verify this capability. */
  tests: BehavioralTest[];
  /** Source module(s) implementing this capability. */
  sources: string[];
  /** Dependencies on other capabilities. */
  dependsOn: string[];
  /** Since when this capability exists (version/tag). */
  since: string;
  /** Whether this capability is active. */
  active: boolean;
  /** Content hash for integrity. */
  hash: string;
}

/** The capability manifest. */
export interface CapabilityManifest {
  /** Manifest version. */
  version: number;
  /** Generation timestamp. */
  generatedAt: string;
  /** All capabilities. */
  capabilities: CapabilityManifestEntry[];
  /** Capability index by ID. */
  byId: Record<string, CapabilityManifestEntry>;
}

/** Preservation gate result. */
export interface PreservationGateResult {
  /** Whether the gate passes. */
  pass: boolean;
  /** Missing capabilities (had a home, now lost). */
  missing: CapabilityManifestEntry[];
  /** New capabilities (not in previous manifest). */
  added: CapabilityManifestEntry[];
  /** Modified capabilities (hash changed). */
  modified: { previous: CapabilityManifestEntry; current: CapabilityManifestEntry }[];
  /** Disposition for missing capabilities. */
  dispositions: Record<string, 'archived' | 'moved' | 'consolidated' | 'unknown'>;
}

/** Generate content hash for an entry. */
function hashEntry(entry: Omit<CapabilityManifestEntry, 'hash'>): string {
  return createHash('sha256').update(JSON.stringify(entry)).digest('hex').slice(0, 16);
}

/** Extract capabilities from faculty specifications. */
export function extractFacultyCapabilities(faculties: readonly FacultySpec[]): CapabilityManifestEntry[] {
  const capabilities: CapabilityManifestEntry[] = [];

  for (const spec of faculties) {
    if (!spec.enabled) continue;

    const categoryMap: Record<string, CapabilityCategory> = {
      perception: 'perception',
      inference: 'inference',
      learning: 'learning',
      reasoning: 'reasoning',
      planning: 'planning',
      evaluation: 'evaluation',
      communication: 'communication',
      governance: 'governance',
    };

    const category = categoryMap[spec.category] ?? 'reasoning';

    // Find behavioral tests for this faculty
    const tests = findBehavioralTests(spec.name);

    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `faculty.${spec.name}`,
      name: spec.name,
      category,
      owner: 'faculty-engine',
      behavior: spec.description,
      tests,
      sources: [`src/faculties/fallback.ts`, `src/faculties/specs.ts`],
      dependsOn: spec.oracleOperation ? [`oracle.${spec.oracleOperation}`] : [],
      since: '0.1.0',
      active: true,
    };

    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from oracle operations. */
export function extractOracleCapabilities(operations: readonly OracleOperation[]): CapabilityManifestEntry[] {
  const providerMap: Record<OracleOperation, { provider: string; description: string }> = {
    'lm.generateText': { provider: 'lm', description: 'Text generation via language model' },
    'lm.generateObject': { provider: 'lm', description: 'Structured object generation via language model' },
    'lm.stream': { provider: 'lm', description: 'Streaming language model output' },
    'retrieval.query': { provider: 'retrieval', description: 'Semantic retrieval query' },
    'engine.z3': { provider: 'z3', description: 'SMT solving via Z3' },
    'engine.clingo': { provider: 'clingo', description: 'ASP solving via Clingo' },
    'engine.minisat': { provider: 'minisat', description: 'SAT solving via MiniSat' },
    'engine.tau-prolog': { provider: 'tau-prolog', description: 'Prolog reasoning via Tau Prolog' },
    'engine.metta': { provider: 'metta', description: 'MeTTa reasoning engine' },
    'engine.custom': { provider: 'custom', description: 'Custom engine oracle' },
    'formalization.nlToFormal': { provider: 'formalization', description: 'Natural language to formal translation' },
    'formalization.formalToNl': { provider: 'formalization', description: 'Formal to natural language translation' },
    'embedding.generate': { provider: 'embedding', description: 'Embedding vector generation' },
    'embedding.rerank': { provider: 'embedding', description: 'Embedding-based reranking' },
    'embedding.contrastiveScore': { provider: 'embedding', description: 'Contrastive similarity scoring' },
    'embedding.mineHardNegatives': { provider: 'embedding', description: 'Hard negative mining via embeddings' },
    'distillation.record': { provider: 'distillation', description: 'Record distillation data' },
    'distillation.fitCalibration': { provider: 'distillation', description: 'Fit calibration model' },
    'distillation.bakeOff': { provider: 'distillation', description: 'Run distillation bake-off' },
    'distillation.validateHead': { provider: 'distillation', description: 'Validate distilled head' },
    'distillation.loadLock': { provider: 'distillation', description: 'Load distillation lock' },
    'distillation.applyLock': { provider: 'distillation', description: 'Apply distillation lock' },
    'gbnf.generateGrammar': { provider: 'gbnf', description: 'Generate GBNF grammar' },
    'gbnf.constrainedGenerate': { provider: 'gbnf', description: 'Constrained generation via GBNF' },
    'gbnf.getActions': { provider: 'gbnf', description: 'Get available GBNF actions' },
    'learnedHead.load': { provider: 'learnedHead', description: 'Load learned head' },
    'learnedHead.evaluate': { provider: 'learnedHead', description: 'Evaluate learned head' },
    'learnedHead.health': { provider: 'learnedHead', description: 'Check learned head health' },
    'cascade.groundedness': { provider: 'cascade', description: 'Groundedness cascade' },
    'cascade.traceGrade': { provider: 'cascade', description: 'Trace grade cascade' },
    'cascade.wakeGate': { provider: 'cascade', description: 'Wake gate cascade' },
    'cascade.resourceCharge': { provider: 'cascade', description: 'Resource charge cascade' },
    'creditAssignment.mcReturn': { provider: 'creditAssignment', description: 'Monte Carlo return credit assignment' },
    'creditAssignment.recordMcReturn': { provider: 'creditAssignment', description: 'Record Monte Carlo return' },
    'creditAssignment.decide': { provider: 'creditAssignment', description: 'Decide credit assignment' },
    'creditAssignment.step': { provider: 'creditAssignment', description: 'Step credit assignment' },
    'creditAssignment.runEpisode': { provider: 'creditAssignment', description: 'Run credit assignment episode' },
    'imagination.generate': { provider: 'imagination', description: 'Generate imagination' },
    'imagination.run': { provider: 'imagination', description: 'Run imagination' },
    'imagination.profiles': { provider: 'imagination', description: 'Imagination profiles' },
    'self.mod.tuneKnob': { provider: 'self-mod', description: 'Tune hyperparameter knobs via self-modification' },
    'self.mod.switchStrategy': { provider: 'self-mod', description: 'Switch reasoning strategies at runtime' },
    'self.mod.shadowRun': { provider: 'self-mod', description: 'Run shadow episodes for safe policy evaluation' },
    'self.mod.scaffoldCapability': { provider: 'self-mod', description: 'Generate capability scaffolding from templates' },
    'self.mod.registerTool': { provider: 'self-mod', description: 'Register new tools in the tool registry' },
    'self.mod.registerRule': { provider: 'self-mod', description: 'Register new derivation rules' },
    'self.mod.applyFix': { provider: 'self-mod', description: 'Apply automated fixes to code' },
    'transport.cli': { provider: 'transport', description: 'Command-line interface transport' },
    'transport.http': { provider: 'transport', description: 'HTTP/REST transport for remote access' },
    'transport.ws': { provider: 'transport', description: 'WebSocket transport for real-time communication' },
    'transport.irc': { provider: 'transport', description: 'IRC transport for chat integration' },
    'transport.mcp': { provider: 'transport', description: 'Model Context Protocol transport' },
    'transport.stdio': { provider: 'transport', description: 'Standard I/O transport for subprocess communication' },
  };

  const capabilities: CapabilityManifestEntry[] = [];

  for (const op of operations) {
    const info = providerMap[op];
    if (!info) continue;

    const tests = findOracleBehavioralTests(op);

    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `oracle.${op}`,
      name: op,
      category: 'coordination',
      owner: 'oracle-seam',
      behavior: info.description,
      tests,
      sources: info.provider === 'self-mod'
        ? [`src/tools/adapters/self/${op.split('.')[2]}.ts`, `src/oracles/oracle.ts`]
        : info.provider === 'transport'
        ? [`src/surface/transports/${op.split('.')[1]}.ts`, `src/oracles/oracle.ts`]
        : [`src/oracles/engines/${info.provider}.ts`, `src/oracles/oracle.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };

    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Find behavioral tests for a faculty. */
function findBehavioralTests(facultyName: string): BehavioralTest[] {
  // Known behavioral tests per faculty
  const testMap: Record<string, BehavioralTest[]> = {
    grounding: [
      { path: 'tests/e2e/belief-import-export.test.ts', suite: 'Belief Import/Export', case: 'grounding round-trips', verifies: 'Perceptual grounding produces stable referents' },
      { path: 'tests/obligations/06-seeded-replay.test.ts', suite: 'W1 — seeded end-to-end replay', case: 'replays byte-identically from the same seed', verifies: 'Grounding integrates with deterministic replay' },
    ],
    inference: [
      { path: 'tests/logic/verdict.test.ts', suite: 'Logic verdict', case: 'proves a simple inheritance chain', verifies: 'SLD resolution derives correct conclusions' },
    ],
    abduction: [
      { path: 'tests/logic/registry.test.ts', suite: 'W1 — per-instance registries', case: 'creates an isolated faculty registry with the core faculties', verifies: 'Abduction faculty registers and isolates correctly' },
    ],
    induction: [],
    analogy: [],
    revision: [],
    planning: [
      { path: 'tests/unit/nar/weighted-sample.test.ts', suite: 'Weighted sampling', case: 'samples proportionally to weights', verifies: 'Planning selects actions by utility' },
    ],
    evaluation: [],
    communication: [],
    governance: [],
  };

  return testMap[facultyName] ?? [];
}

/** Find behavioral tests for an oracle operation. */
function findOracleBehavioralTests(operation: OracleOperation): BehavioralTest[] {
  const testMap: Record<OracleOperation, BehavioralTest[]> = {
    'engine.tau-prolog': [
      { path: 'tests/logic/verdict.test.ts', suite: 'Logic verdict', case: 'proves a simple inheritance chain', verifies: 'Tau Prolog resolves SLD proofs correctly' },
    ],
    'engine.z3': [],
    'engine.clingo': [],
    'engine.minisat': [],
    'engine.metta': [],
    'engine.custom': [],
    'lm.generateText': [],
    'lm.generateObject': [],
    'lm.stream': [],
    'retrieval.query': [],
    'formalization.nlToFormal': [],
    'formalization.formalToNl': [],
    'embedding.generate': [],
    'embedding.rerank': [],
    'embedding.contrastiveScore': [],
    'embedding.mineHardNegatives': [],
    'distillation.record': [],
    'distillation.fitCalibration': [],
    'distillation.bakeOff': [],
    'distillation.validateHead': [],
    'distillation.loadLock': [],
    'distillation.applyLock': [],
    'gbnf.generateGrammar': [],
    'gbnf.constrainedGenerate': [],
    'gbnf.getActions': [],
    'learnedHead.load': [],
    'learnedHead.evaluate': [],
    'learnedHead.health': [],
    'cascade.groundedness': [],
    'cascade.traceGrade': [],
    'cascade.wakeGate': [],
    'cascade.resourceCharge': [],
    'creditAssignment.mcReturn': [],
    'creditAssignment.recordMcReturn': [],
    'creditAssignment.decide': [],
    'creditAssignment.step': [],
    'creditAssignment.runEpisode': [],
    'imagination.generate': [],
    'imagination.run': [],
    'imagination.profiles': [],
    'self.mod.tuneKnob': [
      { path: 'tests/nar/todo7-validation.test.ts', suite: 'Validation', case: 'sabotage: self-mod attacks are refused at three layers', verifies: 'Self-mod tune-knob is gated by validation layers' },
    ],
    'self.mod.switchStrategy': [
      { path: 'tests/nar/todo7-validation.test.ts', suite: 'Validation', case: 'sabotage: self-mod attacks are refused at three layers', verifies: 'Self-mod switch-strategy is gated by validation layers' },
    ],
    'self.mod.shadowRun': [
      { path: 'tests/nar/todo7-validation.test.ts', suite: 'Validation', case: 'sabotage: self-mod attacks are refused at three layers', verifies: 'Self-mod shadow-run is gated by validation layers' },
    ],
    'self.mod.scaffoldCapability': [
      { path: 'tests/nar/todo7-validation.test.ts', suite: 'Validation', case: 'sabotage: self-mod attacks are refused at three layers', verifies: 'Self-mod scaffold-capability is gated by validation layers' },
    ],
    'self.mod.registerTool': [
      { path: 'tests/nar/todo7-validation.test.ts', suite: 'Validation', case: 'sabotage: self-mod attacks are refused at three layers', verifies: 'Self-mod register-tool is gated by validation layers' },
    ],
    'self.mod.registerRule': [
      { path: 'tests/nar/todo7-validation.test.ts', suite: 'Validation', case: 'sabotage: self-mod attacks are refused at three layers', verifies: 'Self-mod register-rule is gated by validation layers' },
    ],
    'self.mod.applyFix': [
      { path: 'tests/nar/todo7-validation.test.ts', suite: 'Validation', case: 'sabotage: self-mod attacks are refused at three layers', verifies: 'Self-mod apply-fix is gated by validation layers' },
    ],
    'transport.cli': [],
    'transport.http': [],
    'transport.ws': [],
    'transport.irc': [],
    'transport.mcp': [],
    'transport.stdio': [],
  };

  return testMap[operation] ?? [];
}

/** Extract capabilities from game registry. */
export function extractGameCapabilities(): CapabilityManifestEntry[] {
  const games = [
    { id: 'snake', name: 'Snake', description: 'Snake on a bounded grid eats apples; body/wall hits end the episode' },
    { id: 'tetris', name: 'Tetris', description: 'Tetris placements (hard drop); clear lines score, topping out ends the episode' },
    { id: '2048', name: '2048', description: 'Slide tiles to merge equals; illegal (no-op) moves end the episode' },
    { id: 'tictactoe', name: 'TicTacToe', description: 'X vs a built-in opponent; +1 win, 0 draw, −1 loss' },
    { id: 'gridworld', name: 'GridWorld', description: 'Grid maze to the goal (+1); each non-goal step costs −0.01' },
    { id: 'bandit', name: 'Multi-Armed Bandit', description: 'Multi-armed bandit, Bernoulli rewards with known arm means' },
    { id: 'catch', name: 'Catch', description: 'Catch falling targets with the paddle: +1 catch, −1 miss' },
    { id: 'arithmetic', name: 'Arithmetic', description: 'Answer a+b / a−b by picking a candidate: +1 correct, 0 wrong' },
    { id: 'rps', name: 'Rock-Paper-Scissors', description: 'Repeated rock-paper-scissors vs a rotating deterministic opponent' },
    { id: 'reasoning:conversation', name: 'Reasoning: Conversation', description: 'Cognitive operations over conversation eval tasks' },
    { id: 'reasoning:tool-use', name: 'Reasoning: Tool Use', description: 'Cognitive operations over tool-use eval tasks' },
    { id: 'reasoning:research', name: 'Reasoning: Research', description: 'Cognitive operations over research eval tasks' },
    { id: 'conversation', name: 'ConversationGame', description: 'Multi-turn dialogue game with reflexes and contrastive vetoes' },
    { id: 'metagame', name: 'MetaGame', description: 'Meta-game over multiple game instances' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const game of games) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `game.${game.id}`,
      name: game.name,
      category: 'games',
      owner: 'game-engine',
      behavior: game.description,
      tests: [
        { path: 'tests/nar/game-registry.test.ts', suite: 'GameRegistry', case: `same seed ⇒ identical episode for every registered game (${game.id})`, verifies: `Game ${game.name} produces deterministic replay from seed` },
        { path: 'tests/nar/game-registry.test.ts', suite: 'GameRegistry', case: 'default arcade collection ships every game with a description + action legend', verifies: 'Game registry provides complete specs for all games' },
      ],
      sources: ['src/game/registry.ts', `src/game/impls/${game.id.includes(':') ? 'ReasoningGame' : game.id.charAt(0).toUpperCase() + game.id.slice(1)}Game.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from RL baselines. */
export function extractRLBaselineCapabilities(): CapabilityManifestEntry[] {
  const baselines = [
    { id: 'epsilon-greedy', name: 'Epsilon-Greedy', description: 'Epsilon-greedy bandit algorithm with configurable exploration' },
    { id: 'ucb1', name: 'UCB1', description: 'Upper Confidence Bound bandit algorithm' },
    { id: 'q-learning', name: 'Q-Learning', description: 'Q-Learning for gridworld environments' },
    { id: 'sarsa', name: 'SARSA', description: 'SARSA for gridworld environments' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const baseline of baselines) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `rl.${baseline.id}`,
      name: baseline.name,
      category: 'rl',
      owner: 'rl-baselines',
      behavior: baseline.description,
      tests: [
        { path: 'tests/nar/rl/games.test.ts', suite: 'Games (DQ2: Game is the only environment interface)', case: 'deterministic with same seed and zero slip', verifies: `${baseline.name} produces deterministic episodes from seed` },
        { path: 'tests/nar/rl/games.test.ts', suite: 'Games (DQ2: Game is the only environment interface)', case: 'deterministic with same seed', verifies: `${baseline.name} bandit/gridworld is deterministic from seed` },
      ],
      sources: ['src/rl/baselines/index.ts'],
      dependsOn: ['game.bandit', 'game.gridworld'],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from cognitive analyzers. */
export function extractAnalyzerCapabilities(): CapabilityManifestEntry[] {
  const analyzers = [
    { id: 'capabilities', name: 'Capabilities Analyzer', description: 'Analyzes agent capability utilization and coverage' },
    { id: 'constants', name: 'Constants Analyzer', description: 'Detects and tracks constant values in reasoning' },
    { id: 'corrections', name: 'Corrections Analyzer', description: 'Analyzes belief corrections and revisions' },
    { id: 'performance', name: 'Performance Analyzer', description: 'Measures reasoning performance metrics' },
    { id: 'quality', name: 'Quality Analyzer', description: 'Assesses reasoning quality and coherence' },
    { id: 'reasoning-patterns', name: 'Reasoning Patterns Analyzer', description: 'Detects recurring reasoning patterns' },
    { id: 'resources', name: 'Resources Analyzer', description: 'Tracks computational resource usage' },
    { id: 'term-patterns', name: 'Term Patterns Analyzer', description: 'Analyzes term usage patterns in memory' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const analyzer of analyzers) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `analyzer.${analyzer.id}`,
      name: analyzer.name,
      category: 'analysis',
      owner: 'cognitive-analyzers',
      behavior: analyzer.description,
      tests: [
        { path: 'tests/nar/rl/parity/cognitive-advantage.test.ts', suite: 'Cognitive Advantage', case: 'through conflict analyzers and truth revision', verifies: `${analyzer.name} integrates with cognitive advantage measurement` },
      ],
      sources: [`src/cognitive/impls/analyzers/${analyzer.id}.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from self-modification tools. */
export function extractSelfModCapabilities(): CapabilityManifestEntry[] {
  const tools = [
    { id: 'tune-knob', name: 'Tune Knob', description: 'Adjusts hyperparameter knobs via self-modification' },
    { id: 'switch-strategy', name: 'Switch Strategy', description: 'Switches reasoning strategies at runtime' },
    { id: 'shadow-run', name: 'Shadow Run', description: 'Runs shadow episodes for safe policy evaluation' },
    { id: 'scaffold-capability', name: 'Scaffold Capability', description: 'Generates capability scaffolding from templates' },
    { id: 'register-tool', name: 'Register Tool', description: 'Registers new tools in the tool registry' },
    { id: 'register-rule', name: 'Register Rule', description: 'Registers new derivation rules' },
    { id: 'apply-fix', name: 'Apply Fix', description: 'Applies automated fixes to code' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const tool of tools) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `self-mod.${tool.id}`,
      name: tool.name,
      category: 'self-mod',
      owner: 'self-mod-tools',
      behavior: tool.description,
      tests: [
        { path: 'tests/nar/todo7-validation.test.ts', suite: 'Validation', case: 'sabotage: self-mod attacks are refused at three layers', verifies: `Self-mod ${tool.name} is gated by validation layers` },
      ],
      sources: [`src/tools/adapters/self/${tool.id}.ts`],
      dependsOn: ['tool.registry'],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from focus system. */
export function extractFocusCapabilities(): CapabilityManifestEntry[] {
  const focusCaps = [
    { id: 'focus', name: 'Focus', description: 'Core focus mechanism for attention allocation' },
    { id: 'focus-bag', name: 'FocusBag', description: 'Priority bag for focus tasks with decay' },
    { id: 'focus-tree', name: 'FocusTree', description: 'Hierarchical focus tree for structured attention' },
    { id: 'focus-scheduler', name: 'FocusScheduler', description: 'Schedules focus ticks across episodes' },
    { id: 'game-focus', name: 'GameFocus', description: 'Focus integration with game environments' },
    { id: 'meta-focus', name: 'MetaFocus', description: 'Meta-level focus for strategy selection' },
    { id: 'schema-store', name: 'SchemaStore', description: 'Stores and retrieves induced schemas' },
    { id: 'belief-seeding', name: 'Belief Seeding', description: 'Seeds initial beliefs for new concepts' },
    { id: 'episode-schemas', name: 'Episode Schemas', description: 'Induces schemas from episode traces' },
    { id: 'nal-ab', name: 'NAL A/B Test', description: 'A/B testing for NAL rule variants' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const cap of focusCaps) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `focus.${cap.id}`,
      name: cap.name,
      category: 'focus',
      owner: 'focus-engine',
      behavior: cap.description,
      tests: [
        { path: 'tests/nar/focus-game-reflex/kernel-slice1.test.ts', suite: 'Kernel Slice 1', case: 'focus.id', verifies: `${cap.name} integrates with kernel slice` },
      ],
      sources: [`src/focus/${cap.id === 'focus-bag' ? 'FocusBag' : cap.id === 'focus-tree' ? 'FocusTree' : cap.id === 'focus-scheduler' ? 'focus-scheduler' : cap.id === 'game-focus' ? 'GameFocus' : cap.id === 'meta-focus' ? 'MetaFocus' : cap.id === 'schema-store' ? 'schema-store' : cap.id === 'belief-seeding' ? 'belief-seeding' : cap.id === 'episode-schemas' ? 'episode-schemas' : cap.id === 'nal-ab' ? 'nal-ab' : 'Focus'}.ts`],
      dependsOn: ['memory.index'],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from NL (Natural Language) module. */
export function extractNLCapabilities(): CapabilityManifestEntry[] {
  const nlCaps = [
    { id: 'understanding', name: 'NL Understanding', description: 'Parses and understands natural language input' },
    { id: 'formalizer', name: 'Formalizer', description: 'Converts natural language to formal NARS terms' },
    { id: 'generation', name: 'NL Generation', description: 'Generates natural language from formal terms' },
    { id: 'explanation', name: 'Explanation Generator', description: 'Generates explanations for reasoning traces' },
    { id: 'clarification', name: 'Clarification Handler', description: 'Handles clarification dialogs for ambiguous input' },
    { id: 'firewall', name: 'Symbolic Firewall', description: 'Filters and validates formalizations' },
    { id: 'classifier', name: 'Input Classifier', description: 'Classifies input type and intent' },
    { id: 'context-assembler', name: 'Context Assembler', description: 'Assembles context for NL processing' },
    { id: 'cache', name: 'Translation Cache', description: 'Caches NL translations for efficiency' },
    { id: 'narsese-intent', name: 'Narsese Intent Dispatcher', description: 'Dispatches Narsese intent to handlers' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const cap of nlCaps) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `nl.${cap.id}`,
      name: cap.name,
      category: 'nl',
      owner: 'nl-engine',
      behavior: cap.description,
      tests: [],
      sources: [`src/nl/${cap.id}.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from schema induction (mining lane). */
export function extractSchemaInductionCapabilities(): CapabilityManifestEntry[] {
  const entry: Omit<CapabilityManifestEntry, 'hash'> = {
    id: 'mining.schema-induction',
    name: 'Schema Induction Mining Lane',
    category: 'mining',
    owner: 'mining-engine',
    behavior: 'Induces reusable schemas from successful derivation patterns via AIKR-bounded fold queries over the event log',
    tests: [
      { path: 'tests/nar/rl/parity/cognitive-advantage.test.ts', suite: 'Cognitive Advantage', case: 'derivation chains can be recorded for schema induction', verifies: 'SchemaInductor admits and processes derivation chains' },
      { path: 'tests/nar/todo25-derivation-capture.test.ts', suite: 'Derivation Capture', case: 'captured chains round-trip through SchemaInductor (real Memory, deterministic LM double)', verifies: 'Schema induction round-trips captured chains' },
    ],
    sources: ['src/learning/schema-induction.ts', 'src/mining/schema-mining.ts'],
    dependsOn: ['memory.index', 'oracle.lm.generateText'],
    since: '0.1.0',
    active: true,
  };
  return [{ ...entry, hash: hashEntry(entry) }];
}

/** Extract capabilities from schema validation. */
export function extractSchemaCapabilities(): CapabilityManifestEntry[] {
  const schemas = [
    { id: 'truth', name: 'Truth Schema', description: 'Validates truth values and source quality' },
    { id: 'reasoning-budget', name: 'Reasoning Budget Schema', description: 'Validates reasoning budget constraints' },
    { id: 'cognitive-events', name: 'Cognitive Events Schema', description: 'Validates cognitive event log entries' },
    { id: 'governance', name: 'Governance Schema', description: 'Validates governance proposals and decisions' },
    { id: 'gate-io', name: 'Gate I/O Schema', description: 'Validates gate inputs and outputs' },
    { id: 'proposal', name: 'Proposal Schema', description: 'Validates self-modification proposals' },
    { id: 'rule-table', name: 'Rule Table Schema', description: 'Validates rule table structure' },
    { id: 'task', name: 'Task Schema', description: 'Validates task types and punctuation' },
    { id: 'derivation-records', name: 'Derivation Records Schema', description: 'Validates derivation step records' },
    { id: 'formalization', name: 'Formalization Schema', description: 'Validates formalization candidates' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const schema of schemas) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `schema.${schema.id}`,
      name: schema.name,
      category: 'schema',
      owner: 'schema-validation',
      behavior: schema.description,
      tests: [],
      sources: [`src/schemas/${schema.id}.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from surface transports. */
export function extractTransportCapabilities(): CapabilityManifestEntry[] {
  const transports = [
    { id: 'cli', name: 'CLI Transport', description: 'Command-line interface transport' },
    { id: 'http', name: 'HTTP Transport', description: 'HTTP/REST transport for remote access' },
    { id: 'ws', name: 'WebSocket Transport', description: 'WebSocket transport for real-time communication' },
    { id: 'irc', name: 'IRC Transport', description: 'IRC transport for chat integration' },
    { id: 'mcp', name: 'MCP Transport', description: 'Model Context Protocol transport' },
    { id: 'stdio', name: 'Stdio Transport', description: 'Standard I/O transport for subprocess communication' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const transport of transports) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `transport.${transport.id}`,
      name: transport.name,
      category: 'transport',
      owner: 'surface-transports',
      behavior: transport.description,
      tests: [],
      sources: [`src/surface/transports/${transport.id}.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from premise selection strategies. */
export function extractPremiseCapabilities(): CapabilityManifestEntry[] {
  const premises = [
    { id: 'selection', name: 'Premise Selection', description: 'Selects premises for inference steps' },
    { id: 'term-link', name: 'Term Link Premise', description: 'Links premises via term relationships' },
    { id: 'prolog-resolution', name: 'Prolog Resolution Premise', description: 'Uses Prolog-style resolution for premises' },
    { id: 'primitives', name: 'Premise Primitives', description: 'Primitive premise operations' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const premise of premises) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `premise.${premise.id}`,
      name: premise.name,
      category: 'reasoning',
      owner: 'premise-strategies',
      behavior: premise.description,
      tests: [],
      sources: [`src/strategies/premise/${premise.id}.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Extract capabilities from memory indexes. */
export function extractMemoryIndexCapabilities(): CapabilityManifestEntry[] {
  const indexes = [
    { id: 'memory-index', name: 'Memory Index', description: 'Atomic and temporal indexes for concept retrieval' },
    { id: 'causal-index', name: 'Causal Index', description: 'Indexes causal relationships between concepts' },
    { id: 'episodic-memory', name: 'Episodic Memory', description: 'Stores and retrieves episodic traces' },
    { id: 'concept-graph', name: 'Concept Graph', description: 'Graph structure over concepts and links' },
    { id: 'associative', name: 'Associative Memory', description: 'Associative retrieval via embedding layers' },
    { id: 'fold-memory', name: 'Fold Memory', description: 'Memory as fold views over event log' },
    { id: 'focus-memory', name: 'Focus Memory', description: 'Memory integration with focus system' },
  ];

  const capabilities: CapabilityManifestEntry[] = [];

  for (const index of indexes) {
    const entry: Omit<CapabilityManifestEntry, 'hash'> = {
      id: `memory.${index.id}`,
      name: index.name,
      category: 'memory',
      owner: 'memory-engine',
      behavior: index.description,
      tests: [
        { path: 'tests/nar/unit/memory-index.test.ts', suite: 'MemoryIndex', case: 're-indexing the same concept does not duplicate it', verifies: `${index.name} maintains correct index state` },
      ],
      sources: [`src/memory/${index.id === 'memory-index' ? 'memory-index' : index.id === 'causal-index' ? 'CausalIndex' : index.id === 'episodic-memory' ? 'EpisodicMemory' : index.id === 'concept-graph' ? 'ConceptGraph' : index.id === 'associative' ? 'associative' : index.id === 'fold-memory' ? 'fold-memory' : 'focus'}.ts`],
      dependsOn: [],
      since: '0.1.0',
      active: true,
    };
    capabilities.push({ ...entry, hash: hashEntry(entry) });
  }

  return capabilities;
}

/** Build the capability manifest from all registries. */
export async function buildCapabilityManifest(): Promise<CapabilityManifest> {
  const { CORE_FACULTIES } = await import('../src/faculties/specs.js');
  const { ORACLE_OPERATIONS } = await import('../src/oracles/oracle.js');

  const facultyCapabilities = extractFacultyCapabilities(CORE_FACULTIES);
  const oracleCapabilities = extractOracleCapabilities(ORACLE_OPERATIONS);
  const gameCapabilities = extractGameCapabilities();
  const rlCapabilities = extractRLBaselineCapabilities();
  const analyzerCapabilities = extractAnalyzerCapabilities();
  const selfModCapabilities = extractSelfModCapabilities();
  const focusCapabilities = extractFocusCapabilities();
  const nlCapabilities = extractNLCapabilities();
  const schemaCapabilities = extractSchemaCapabilities();
  const schemaInductionCapabilities = extractSchemaInductionCapabilities();
  const transportCapabilities = extractTransportCapabilities();
  const premiseCapabilities = extractPremiseCapabilities();
  const memoryIndexCapabilities = extractMemoryIndexCapabilities();

  const allCapabilities = [
    ...facultyCapabilities,
    ...oracleCapabilities,
    ...gameCapabilities,
    ...rlCapabilities,
    ...analyzerCapabilities,
    ...selfModCapabilities,
    ...focusCapabilities,
    ...nlCapabilities,
    ...schemaCapabilities,
    ...schemaInductionCapabilities,
    ...transportCapabilities,
    ...premiseCapabilities,
    ...memoryIndexCapabilities,
  ];

  const byId: Record<string, CapabilityManifestEntry> = {};
  for (const cap of allCapabilities) {
    byId[cap.id] = cap;
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    capabilities: allCapabilities,
    byId,
  };
}

/** Write manifest to disk. */
export async function writeManifest(manifest: CapabilityManifest, path?: string): Promise<void> {
  const outputPath = path ?? join(REPO_ROOT, 'capability-manifest.json');
  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2) + '\n');
}

/** Read manifest from disk. */
export async function readManifest(path?: string): Promise<CapabilityManifest | null> {
  const inputPath = path ?? join(REPO_ROOT, 'capability-manifest.json');
  try {
    const content = await fs.readFile(inputPath, 'utf-8');
    return JSON.parse(content) as CapabilityManifest;
  } catch {
    return null;
  }
}

/** Run the preservation gate against a previous manifest. */
export async function runPreservationGate(
  current: CapabilityManifest,
  previousPath?: string
): Promise<PreservationGateResult> {
  const previous = await readManifest(previousPath);

  if (!previous) {
    return {
      pass: true,
      missing: [],
      added: current.capabilities,
      modified: [],
      dispositions: {},
    };
  }

  const missing: CapabilityManifestEntry[] = [];
  const added: CapabilityManifestEntry[] = [];
  const modified: { previous: CapabilityManifestEntry; current: CapabilityManifestEntry }[] = [];
  const dispositions: Record<string, 'archived' | 'moved' | 'consolidated' | 'unknown'> = {};

  // Check for missing capabilities
  for (const prevCap of previous.capabilities) {
    const currentCap = current.byId[prevCap.id];
    if (!currentCap) {
      missing.push(prevCap);
      dispositions[prevCap.id] = 'unknown';
    } else if (currentCap.hash !== prevCap.hash) {
      modified.push({ previous: prevCap, current: currentCap });
    }
  }

  // Check for added capabilities
  for (const currentCap of current.capabilities) {
    if (!previous.byId[currentCap.id]) {
      added.push(currentCap);
    }
  }

  // Gate passes if no missing capabilities without approved disposition
  const unapprovedMissing = missing.filter(c => dispositions[c.id] === 'unknown');
  const pass = unapprovedMissing.length === 0;

  return { pass, missing, added, modified, dispositions };
}

/** CLI for generating the manifest. */
export async function generateManifestCLI(): Promise<void> {
  const manifest = await buildCapabilityManifest();
  await writeManifest(manifest);
  console.log(`Capability manifest generated: ${manifest.capabilities.length} capabilities`);
}

/** CLI for running the preservation gate. */
export async function preservationGateCLI(): Promise<void> {
  const current = await buildCapabilityManifest();
  const result = await runPreservationGate(current);

  console.log('Preservation Gate:', result.pass ? 'PASS' : 'FAIL');
  console.log(`  Current capabilities: ${current.capabilities.length}`);
  console.log(`  Missing: ${result.missing.length}`);
  console.log(`  Added: ${result.added.length}`);
  console.log(`  Modified: ${result.modified.length}`);

  if (result.missing.length > 0) {
    console.log('\nMissing capabilities (require disposition):');
    for (const cap of result.missing) {
      console.log(`  - ${cap.id}: ${cap.behavior}`);
    }
  }

  if (!result.pass) {
    process.exit(1);
  }
}