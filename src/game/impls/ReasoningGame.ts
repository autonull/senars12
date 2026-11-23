import type { Game, GameOutcome, Perception } from '../Game';
import { GameBase, type GameConfig } from '../GameBase';
import { SeededRNG } from '@senars/util/random';
import type { CapabilityTier } from '../../agent/profiles';
import type { CognitionAction, Reward, Sensor } from '../types';
import { composeReward, DEFAULT_REWARDS } from '../rewards';
import { DEFAULT_ACTIONS } from '../actions';
import { DEFAULT_SENSORS } from '../sensors';

/**
 * Placement: this is the bench workhorse for reasoning quality, not an arcade
 * game, so `reason/` is arguably its home. It stays here because it is a `Game`
 * in exactly the sense `Game.ts` defines — an assembled component library over
 * a spec suite — and the contract is identical either way (TODO28 §2.1).
 *
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
  terminal: boolean;
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

interface ReasoningGameConfig extends GameConfig {
  spec: ReasoningGameOptions;
  tasks: ReasoningTask[];
}

export class ReasoningGame extends GameBase<ReasoningState, string> {
  private readonly spec: ReasoningGameOptions;
  private readonly tasks: ReasoningTask[];
  private taskIndex = 0;
  private task: RunningTask | null = null;
  private tokens = 0;
  private settled = 0;
  private vetoes = 0;
  private consolidations = 0;
  private cycle = 0;
  private terminal_ = false;

  constructor(config: ReasoningGameConfig) {
    super(config.id ?? config.spec.id, config);
    this.spec = config.spec;
    this.tasks = config.tasks;
    this.task = this.tasks.length
      ? { ...this.tasks[0]!, ambiguityRemaining: this.tasks[0]!.ambiguity }
      : null;
  }

  protected override getInitialState(): ReasoningState {
    return {
      taskIndex: 0,
      task: this.tasks.length
        ? { ...this.tasks[0]!, ambiguityRemaining: this.tasks[0]!.ambiguity }
        : null,
      tokens: 0,
      settled: 0,
      vetoes: 0,
      consolidations: 0,
      cycle: 0,
      terminal: false,
    };
  }

  protected override getStateId(state: ReasoningState): string {
    return `${this.spec.id}#t${state.cycle}`;
  }

  /** R2: tier gates legalActions — tier-0 reflex ops only; ask_lm needs tier ≥ 2. */
  override legalActions(state: ReasoningState): string[] {
    return this.spec.actions
      .filter((a) => a.tier <= this.spec.tier && !(a.id === 'tune'))
      .map((a) => a.id)
      .concat(state.task && state.task.ambiguityRemaining <= 0 ? ['settle'] : [])
      .concat(state.taskIndex < this.tasks.length ? [] : ['finish']);
  }

  override step(action: string): GameOutcome {
    this.cycle++;
    this.incrementStep();
    const task = this.task;
    switch (action) {
      case 'clarify':
        if (task) task.ambiguityRemaining = Math.max(0, task.ambiguityRemaining - 0.4);
        break;
      case 'ask_lm':
        if (task) {
          task.ambiguityRemaining = Math.max(0, task.ambiguityRemaining - 0.6);
          this.tokens += this.spec.askLMTokenCost;
        }
        break;
      case 'spawn_subgoal':
        if (task) task.ambiguityRemaining = Math.max(0, task.ambiguityRemaining - 0.2);
        break;
      case 'consolidate':
        this.consolidations++;
        break;
      case 'revise':
      case 'cycle':
      case 'rest':
        break;
      case 'settle': {
        if (task && task.ambiguityRemaining <= 0) {
          this.settled++;
          this.taskIndex++;
          this.task =
            this.taskIndex < this.tasks.length
              ? {
                  ...this.tasks[this.taskIndex]!,
                  ambiguityRemaining: this.tasks[this.taskIndex]!.ambiguity,
                }
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
    this.terminal_ = this.taskIndex >= this.tasks.length;
    return {
      reward: score,
      terminal: this.terminal_,
      info: { action },
    };
  }

  override isTerminal(state: ReasoningState): boolean {
    return state.terminal;
  }

  override state(): ReasoningState {
    return {
      taskIndex: this.taskIndex,
      task: this.task ? { ...this.task } : null,
      tokens: this.tokens,
      settled: this.settled,
      vetoes: this.vetoes,
      consolidations: this.consolidations,
      cycle: this.cycle,
      terminal: this.terminal_,
    };
  }

  override observe(): Perception {
    const features: Record<string, number> = {
      taskIndex: this.taskIndex,
      tokens: this.tokens,
      settled: this.settled,
      vetoes: this.vetoes,
      consolidations: this.consolidations,
      ambiguity: this.task?.ambiguityRemaining ?? 0,
    };
    for (const sensor of this.spec.sensors) {
      const reading = sensor.read({ outcome: this.outcomeFromState() });
      for (const [k, v] of Object.entries(reading.features))
        features[`${sensor.id}.${k}`] = v * reading.confidence;
    }
    return {
      stateId: this.getStateId(this.state()),
      features,
      confidence: 1,
      terminal: this.terminal_,
    };
  }

  override reset(): ReasoningState {
    this.taskIndex = 0;
    this.task = this.tasks.length
      ? { ...this.tasks[0]!, ambiguityRemaining: this.tasks[0]!.ambiguity }
      : null;
    this.tokens = 0;
    this.settled = 0;
    this.vetoes = 0;
    this.consolidations = 0;
    this.cycle = 0;
    this.terminal_ = false;
    this.stepCount = 0;
    return this.getInitialState();
  }

  private outcomeFromState() {
    return {
      tokens: this.tokens,
      settled: this.settled,
      attempted: this.tasks.length,
      vetoes: this.vetoes,
      consolidations: this.consolidations,
      ambiguityBefore: this.tasks[0]?.ambiguity,
      ambiguityAfter: this.task?.ambiguityRemaining,
    };
  }
}

/** Deterministic eval suite (DQ4: spec data); ambiguity is seeded per task. */
export const generateEvalTasks = (
  spec: ReasoningGameSpec,
  seed: number,
  count?: number
): ReasoningTask[] => {
  const rng = new SeededRNG(seed);
  return Array.from({ length: count ?? spec.tasksPerEpisode }, (_, i) => ({
    id: `${spec.id}#task${i}`,
    ambiguity: 0.5 + rng.next() * 0.5,
    groundedness: rng.next(),
  }));
};

/** Assemble a spec: absent sensor/action/reward lists default to the library seeds. */
export const createReasoningGame = (
  spec: Partial<ReasoningGameOptions> &
    Pick<ReasoningGameSpec, 'id' | 'tier' | 'rewardWeights' | 'tasksPerEpisode' | 'askLMTokenCost'>,
  seed: number,
  tasks?: ReasoningTask[]
): ReasoningGame => {
  const full: ReasoningGameOptions = {
    ...spec,
    sensors: spec.sensors?.length ? spec.sensors : [...DEFAULT_SENSORS],
    actions: spec.actions?.length ? spec.actions : [...DEFAULT_ACTIONS],
    rewards: spec.rewards?.length ? spec.rewards : [...DEFAULT_REWARDS],
  };
  return new ReasoningGame({
    id: full.id,
    seed,
    spec: full,
    tasks: tasks ?? generateEvalTasks(full, seed),
  });
};