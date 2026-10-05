import { promises as fs } from 'node:fs';
import type {
  RewardGateOutput,
  SourceQuality,
  StimulusSource,
  TaskAdmittedEvent,
} from '@senars/core/schemas';
import { clamp, clampSigned, makeId, writeJsonFile } from '@senars/util';
import type { CognitiveParameters } from './config/cognitive-parameters.js';
import type { NARConfig } from './facade/config.js';
import type { GateRegistry, IPerceptionGate, IRewardGate } from './kernel';
import { ExternalRewardGate } from './kernel/KernelRewardGate.js';
import { seedTruth } from './lm/system-one/seed.js';
import type { Memory } from './memory';
import type { RLFPLearner } from './rlfp';
import type { TaskManager } from './task';
import type { Term } from './terms';
import {
  bareInheritancePair,
  sharesInheritanceEnd,
  Truth,
  termParser,
  validateTaskTerm,
} from './terms';
import type { Truth as TruthType } from './terms/impls/Truth.js';
import type { TaskType } from './types';
import { createTaskWeight, type EventBus } from './types';
import type { EventBus as NarEventBus } from './types/events.js';

/** The admitted task the gate hands back — what every caller stores. */
type TaskAdmittedPayload = TaskAdmittedEvent['payload'];

interface SerializedNARState {
  concepts: Array<{ term: string; priority: number; sourceQuality?: SourceQuality }>;
  config: NARConfig;
  timestamp: string;
}

export class NARIO {
  private _eventBus: EventBus | null = null;
  private _systemEventBus: NarEventBus | null = null;
  private cognitiveParams?: CognitiveParameters;
  private perceptionGate: IPerceptionGate;
  private rewardGate: IRewardGate;
  private rlfp?: RLFPLearner;

  constructor(
    private readonly memory: Memory,
    private readonly taskManager: TaskManager,
    private readonly config: NARConfig,
    gates: GateRegistry
  ) {
    this.perceptionGate = gates.getPerceptionGate();
    this.rewardGate = gates.getRewardGate();
    this.rlfp = config.enableRLFP ? undefined : undefined; // Will be set via setRLFP
  }

  setRLFP(rlfp: RLFPLearner | undefined): void {
    this.rlfp = rlfp;
  }

  setCognitiveParams(params: CognitiveParameters): void {
    this.cognitiveParams = params;
  }

  setEventBus(eventBus: EventBus): void {
    this._eventBus = eventBus;
  }

  setSystemEventBus(bus: NarEventBus): void {
    this._systemEventBus = bus;
  }

  private warn(message: string, term?: string): void {
    this._eventBus?.emit('warning', term === undefined ? { message } : { message, term });
  }

  /**
   * Persist a gate-admitted task and announce first sightings.
   * `label` is the surface the gate admitted (may be the raw utterance, pre-normalization),
   * so the `nar:derivation` event keeps the caller-visible string.
   */
  private commitAdmitted(opts: {
    term: Term;
    label: string;
    type: TaskType;
    truth: Truth;
    prime: boolean;
  }): void {
    const { term, label, type, truth, prime } = opts;
    const budget = createTaskWeight(Truth.attention(truth));
    const wasNew = !this.memory.getConcept(term);

    this.memory.addTask(term, type, truth, budget);

    if (wasNew && this._eventBus) {
      this._eventBus.emit('concept:created', { term, priority: budget.priority });
      this._systemEventBus?.emit('nar:derivation', {
        term: label,
        confidence: truth.f,
        timestamp: Date.now(),
      });
    }

    if (prime && (this.cognitiveParams?.attention.autoPrime ?? true)) {
      this.primeAttention(term);
    }
  }

  /** `correlationId` names the stimulus; the gate stamps its admission with it. */
  async input(
    input: string | Term,
    type: TaskType = 'belief',
    truth?: TruthType,
    correlationId: string = makeId()
  ): Promise<void> {
    const systemOneEnabled = this.config.systemOne?.enabled ?? false;

    // When System One is enabled, pass raw observation to gate before parsing
    if (systemOneEnabled && typeof input === 'string') {
      const task = await this.gateAdmit({
        sourceId: 'nar-io',
        source: 'user',
        observation: input,
        sensorConfidence: 1.0,
        sourceQuality: 'GENERAL',
        correlationId,
        refusedAs: 'input',
      });
      if (!task) return;

      // Parse the term for memory storage
      const parsedTerm = termParser.parse(task.term);
      if (!parsedTerm) {
        this.warn('Failed to parse admitted term', task.term);
        return;
      }

      this.commitAdmitted({
        term: parsedTerm,
        label: task.term,
        prime: true,
        // A belief the gate admitted without a truth is an assertion; a goal with
        // no truth is not one, so the fallback follows the kind the gate chose.
        ...this.calibrated(task, {
          truth: task.taskType === 'belief' ? Truth.TRUE : undefined,
          type,
        }),
      });
      return;
    }

    // Legacy path (System One disabled or Term input)
    const { term: parsedTerm, truth: parsedTruth } =
      typeof input === 'string'
        ? termParser.parseWithTruth(input)
        : { term: input, truth: undefined };

    const validation = validateTaskTerm(parsedTerm);
    if (!validation.valid) {
      this.warn(validation.reason, parsedTerm.toString());
      return;
    }

    await this.addTask(parsedTerm, type, truth ?? parsedTruth ?? Truth.TRUE, correlationId);
  }

  async believe(input: string | Term, truth?: TruthType, correlationId?: string): Promise<void> {
    return this.input(input, 'belief', truth, correlationId);
  }

  async goal(input: string | Term, truth?: TruthType, correlationId?: string): Promise<void> {
    return this.input(input, 'goal', truth, correlationId);
  }

  async question(input: string | Term, correlationId?: string): Promise<void> {
    return this.input(input, 'question', undefined, correlationId);
  }

  /**
   * Provide external reward feedback to update policy.
   * Goes through the RewardGate (epistemic firewall) and if accepted, updates the RLFPLearner.
   * @param reward - Reward value between -1 and 1
   * @param context - Optional context about what the reward is for
   */
  async reward(reward: number, context?: string): Promise<RewardGateOutput> {
    const clampedReward = clampSigned(reward);
    const result = this.rewardGate.process({
      eventId: makeId(),
      rewardSignal: clampedReward,
      rewardType: 'extrinsic',
      targetType: 'policy-weights',
      targetId: context ?? 'external-reward',
      domain: 'external-reflex',
    });

    if (result.accepted && result.mutationApplied && this.rlfp) {
      this.rlfp.reward(clampedReward, context);
    }

    return result;
  }

  export(): SerializedNARState {
    return {
      concepts: this.memory.listConcepts().map((c) => ({
        term: c.term.toString(),
        priority: c.priority,
      })),
      config: this.config,
      timestamp: new Date().toISOString(),
    };
  }

  async import(data: SerializedNARState): Promise<void> {
    if (!data.concepts || !Array.isArray(data.concepts)) {
      throw new Error('Invalid import data');
    }

    for (const concept of data.concepts) {
      if (!concept.term) continue;
      const term = termParser.parse(concept.term);
      if (!term) continue;

      const admitted = await this.gateAdmit({
        sourceId: 'import',
        observation: concept.term,
        sensorConfidence: 0.9,
        sourceQuality: concept.sourceQuality ?? 'GENERAL',
        correlationId: makeId(),
        refusedAs: 'import',
      });
      if (!admitted) continue;

      this.memory.addConcept(term);
    }
  }

  async saveToFile(filename: string): Promise<void> {
    const data = this.export();
    await writeJsonFile(filename, data);
  }

  async loadFromFile(filename: string): Promise<void> {
    const content = await fs.readFile(filename, 'utf-8');
    const data = JSON.parse(content);
    this.import(data);
  }

  async getMemoryState(): Promise<SerializedNARState> {
    return this.export();
  }

  async loadMemoryState(state: SerializedNARState): Promise<void> {
    if (state.concepts) {
      await this.import(state);
    }
  }

  /**
   * The one gate round-trip: ask the perception gate for a verdict, and on refusal
   * report why. Four call sites each spelled this out — the System One input path,
   * import, and both `addTask` branches — and they differed only in source id,
   * sensor confidence and the wording of the refusal. A change to the admission
   * protocol therefore had four chances to reach three of them, and one had
   * already drifted: the legacy `addTask` branch minted a fresh `correlationId`
   * instead of the one it was handed, severing the trace from the admission it was
   * meant to identify.
   *
   * Returns the admitted payload, or `null` if the gate refused.
   */
  private async gateAdmit(request: {
    sourceId: string;
    /** Omitted where the gate's `mapSource` heuristic is the right answer. */
    source?: StimulusSource;
    observation: string;
    sensorConfidence: number;
    sourceQuality: SourceQuality;
    correlationId: string;
    refusedAs: string;
  }): Promise<TaskAdmittedPayload | null> {
    const { refusedAs, observation, ...input } = request;
    const result = await this.perceptionGate.admit({
      ...input,
      rawObservation: observation,
    });
    if (!result.admitted || !result.task) {
      this.warn(result.rejectionReason ?? `Perception gate rejected ${refusedAs}`, observation);
      return null;
    }
    return result.task;
  }

  /**
   * Whom the stored truth and task kind come from. System One judges the claim
   * before it is stored, so its verdict wins; with System One off the gate still
   * filters but its calibration is advisory and the caller's own values stand.
   * That was a conditional in each of the two `addTask` branches, and they read
   * the same — one just happened to sit on either side of the `return`.
   */
  private calibrated(
    task: TaskAdmittedPayload,
    fallback: { truth?: TruthType; type: TaskType }
  ): { truth: TruthType; type: TaskType } {
    if (!this.config.systemOne?.enabled) {
      return { truth: fallback.truth ?? Truth.NEUTRAL, type: fallback.type };
    }
    return {
      truth: Truth.fromUnknown(task.truth ?? fallback.truth),
      type: task.taskType as TaskType,
    };
  }

  private async addTask(
    term: Term,
    type: TaskType,
    truth: TruthType = Truth.NEUTRAL,
    correlationId: string = makeId()
  ): Promise<void> {
    const label = term.toString();
    const task = await this.gateAdmit({
      sourceId: 'nar-io',
      source: 'derivation',
      observation: label,
      sensorConfidence: truth.c ?? 0.5,
      sourceQuality: 'GENERAL',
      correlationId,
      refusedAs: 'task',
    });
    if (!task) return;

    this.commitAdmitted({ term, label, prime: true, ...this.calibrated(task, { truth, type }) });
  }

  private primeAttention(term: Term): void {
    const params = this.cognitiveParams;
    const primeBoost = params?.attention.primeBoost ?? 0.3;
    const relatedBoost = params?.attention.relatedBoost ?? 0.15;
    const maxPriority = params?.priority.maxPriority ?? 1.0;

    // Boost priority of the concept itself
    const concept = this.memory.getConcept(term);
    if (concept) {
      concept.writeAttention({ reason: 'prime', amount: primeBoost, cap: maxPriority });
    }

    // Also boost concepts that share terms (simple relevance propagation).
    // The input term's bare pair is loop-invariant: extract once, and skip the
    // O(N) scan entirely when the input mentions no `(a --> b)` (no concept
    // could match, same as areTermsRelated returning false). Reachability is
    // read off the term, not off its string form, and memoized per term — so
    // the scan is a cached lookup per concept rather than a parse.
    if (params?.attention.structuralSimilarity ?? true) {
      if (!bareInheritancePair(term)) return;
      this.memory.forEachConcept((c) => {
        if (c.term === term) return;
        if (sharesInheritanceEnd(term, c.term)) {
          c.writeAttention({ reason: 'related', amount: relatedBoost, cap: maxPriority });
        }
      });
    }
  }
}
