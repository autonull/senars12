import type { Game, GameOutcome, Perception } from '../game/Game.js';
import { SeededRNG } from '../game/SeededRNG.js';
import type { CapabilityTier } from '../agent/profiles.js';
import type { CognitionAction, Reward, Sensor } from './types.js';
import { composeReward, DEFAULT_REWARDS } from './rewards.js';
import { DEFAULT_ACTIONS } from './actions.js';
import { DEFAULT_SENSORS } from './sensors.js';

/**
 * R1: reasoning is a Game. A ReasoningGame is assembled from the component
 * library — `{ id, sensors, actions, rewards, tier, params }` — and plays
 * over an eval task suite (spec data). Cognitive operations (clarify,
 * ask_lm, consolidate…) are the action space; the reward is the weighted
 * composition (weights are game parameters).
 */

export interface ReasoningTask {
  id: string;
  /** 0..1; cognitive ops reduce it toward settledness. */
  ambiguity: number;
  /** Domain truth quality surfaced by asking the LM / cortex ops. */
  groundedness?: number;
}

export interface ReasoningGameSpec {
  id: string;
  tier: CapabilityTier;
  sensors: Sensor[];
  actions: CognitionAction[];
  rewards: Reward[];
  /** Reward weights — game parameters (tunable by ReasoningMetaGame, R3). */
  rewardWeights: Record<string, number>;
  /** Episode length: number of eval tasks per episode. */
  tasksPerEpisode: number;
  /** R2: `ask_lm` token cost; cortex ops spend against the episode budget. */
  askLMTokenCost: number;
}

interface RunningTask extends ReasoningTask {
  ambiguityRemaining: number;
}

export interface ReasoningState {
  taskIndex: number;
  task: RunningTask | null;
  tokens: number;
  settled: number;
  vetoes: number;
  consolidations: number;
  cycle: number;
}

/** Domain presets (R1): per-domain spec data. */
export const REASONING_SPECS: Record<string, ReasoningGameOptions> = {
  'reasoning:conversation': {
    sensors: [],
    actions: [],
    rewards: [],
    id: 'reasoning:conversation',
    tier: 2,
    rewardWeights: { 'task-settled': 0.6, 'ambiguity-reduction': 0.3, 'spend-efficiency': 0.1 },
    tasksPerEpisode: 6,
    askLMTokenCost: 40,
  },
  'reasoning:tool-use': {
    sensors: [],
    actions: [],
    rewards: [],
    id: 'reasoning:tool-use',
    tier: 2,
    rewardWeights: { groundedness: 0.6, 'task-settled': 0.3, 'veto-penalty': 0.1 },
    tasksPerEpisode: 6,
    askLMTokenCost: 30,
  },
  'reasoning:research': {
    sensors: [],
    actions: [],
    rewards: [],
    id: 'reasoning:research',
    tier: 2,
    rewardWeights: { 'task-settled': 0.4, 'ambiguity-reduction': 0.4, consolidation: 0.2 },
    tasksPerEpisode: 6,
    askLMTokenCost: 50,
  },
};

/** Sensor/reward/action composition happens at construction time (library lookups). */
export interface ReasoningGameOptions extends ReasoningGameSpec {
  sensors: Sensor[];
  actions: CognitionAction[];
  rewards: Reward[];
}

export class ReasoningGame implements Game<ReasoningState, string> {
  readonly id: string;
  private readonly spec: ReasoningGameOptions;
  private readonly rng: SeededRNG;
  private readonly tasks: ReasoningTask[];
  private internal: ReasoningState;

  constructor(spec: ReasoningGameOptions, seed: number, tasks: ReasoningTask[]) {
    this.spec = spec;
    this.id = spec.id;
    this.rng = new SeededRNG(seed);
    this.tasks = tasks;
    this.internal = this.initialState();
  }

  private initialState(): ReasoningState {
    return {
      taskIndex: 0,
      task: this.tasks.length ? { ...this.tasks[0]!, ambiguityRemaining: this.tasks[0]!.ambiguity } : null,
      tokens: 0,
      settled: 0,
      vetoes: 0,
      consolidations: 0,
      cycle: 0,
    };
  }

  /** R2: tier gates legalActions — tier-0 reflex ops only; ask_lm needs tier ≥ 2. */
  legalActions(state: ReasoningState): string[] {
    return this.spec.actions
      .filter((a) => a.tier <= this.spec.tier && !(a.id === 'tune'))
      .map((a) => a.id)
      .concat(state.task && state.task.ambiguityRemaining <= 0 ? ['settle'] : [])
      .concat(state.taskIndex < this.tasks.length ? [] : ['finish']);
  }

  observe(): Perception {
    const s = this.internal;
    const features: Record<string, number> = {
      taskIndex: s.taskIndex,
      tokens: s.tokens,
      settled: s.settled,
      vetoes: s.vetoes,
      consolidations: s.consolidations,
      ambiguity: s.task?.ambiguityRemaining ?? 0,
    };
    for (const sensor of this.spec.sensors) {
      const reading = sensor.read({ outcome: this.outcomeFromState() });
      for (const [k, v] of Object.entries(reading.features))
        features[`${sensor.id}.${k}`] = v * reading.confidence;
    }
    return { stateId: `${this.id}#t${s.cycle}`, features, confidence: 1, terminal: s.taskIndex >= this.tasks.length };
  }

  private outcomeFromState() {
    const s = this.internal;
    return {
      tokens: s.tokens,
      settled: s.settled,
      attempted: this.tasks.length,
      vetoes: s.vetoes,
      consolidations: s.consolidations,
      ambiguityBefore: this.tasks[0]?.ambiguity,
      ambiguityAfter: s.task?.ambiguityRemaining,
    };
  }

  step(action: string): GameOutcome {
    this.internal.cycle++;
    const task = this.internal.task;
    switch (action) {
      case 'clarify':
        if (task) task.ambiguityRemaining = Math.max(0, task.ambiguityRemaining - 0.4);
        break;
      case 'ask_lm':
        if (task) {
          task.ambiguityRemaining = Math.max(0, task.ambiguityRemaining - 0.6);
          this.internal.tokens += this.spec.askLMTokenCost;
        }
        break;
      case 'spawn_subgoal':
        if (task) task.ambiguityRemaining = Math.max(0, task.ambiguityRemaining - 0.2);
        break;
      case 'consolidate':
        this.internal.consolidations++;
        break;
      case 'revise':
      case 'cycle':
      case 'rest':
        break;
      case 'settle': {
        if (task && task.ambiguityRemaining <= 0) {
          this.internal.settled++;
          this.internal.taskIndex++;
          this.internal.task =
            this.internal.taskIndex < this.tasks.length
              ? { ...this.tasks[this.internal.taskIndex]!, ambiguityRemaining: this.tasks[this.internal.taskIndex]!.ambiguity }
              : null;
        }
        break;
      }
      default:
        break;
    }
    const score = composeReward(this.spec.rewards, this.spec.rewardWeights, {
      outcome: this.outcomeFromState(),
    });
    return { reward: score, terminal: this.internal.taskIndex >= this.tasks.length, info: { action } };
  }

  state(): ReasoningState {
    return { ...this.internal, task: this.internal.task ? { ...this.internal.task } : null };
  }
}

/** Deterministic eval suite (DQ4: spec data); ambiguity is seeded per task. */
export const generateEvalTasks = (spec: ReasoningGameSpec, seed: number, count?: number): ReasoningTask[] => {
  const rng = new SeededRNG(seed);
  return Array.from({ length: count ?? spec.tasksPerEpisode }, (_, i) => ({
    id: `${spec.id}#task${i}`,
    ambiguity: 0.5 + rng.next() * 0.5,
    groundedness: rng.next(),
  }));
};

/** Assemble a spec: absent sensor/action/reward lists default to the library seeds. */
export const createReasoningGame = (
  spec: Partial<ReasoningGameOptions> & Pick<ReasoningGameSpec, 'id' | 'tier' | 'rewardWeights' | 'tasksPerEpisode' | 'askLMTokenCost'>,
  seed: number,
  tasks?: ReasoningTask[]
): ReasoningGame => {
  const full: ReasoningGameOptions = {
    ...spec,
    sensors: spec.sensors?.length ? spec.sensors : [...DEFAULT_SENSORS],
    actions: spec.actions?.length ? spec.actions : [...DEFAULT_ACTIONS],
    rewards: spec.rewards?.length ? spec.rewards : [...DEFAULT_REWARDS],
  };
  return new ReasoningGame(full, seed, tasks ?? generateEvalTasks(full, seed));
};
