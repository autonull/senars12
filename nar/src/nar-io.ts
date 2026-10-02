import { promises as fs } from 'node:fs';
import type {
  PerceptionGateInput,
  PerceptionGateOutput,
  RewardGateInput,
  RewardGateOutput,
  SourceQuality,
} from '@senars/core/schemas';
import { makeId, writeJsonFile } from '@senars/util';
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
import { createBudget, type EventBus } from './types';
import type { EventBus as NarEventBus } from './types/events.js';

function toTruth(t: TruthType | { frequency: number; confidence: number } | undefined): Truth {
  if (!t) return Truth.NEUTRAL;
  if ('f' in t && 'c' in t) return t as Truth;
  return Truth.create(t.frequency, t.confidence);
}

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
    const budget = createBudget(truth.f * truth.c);
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

  async input(input: string | Term, type: TaskType = 'belief', truth?: TruthType): Promise<void> {
    const gate = this.perceptionGate;
    const systemOneEnabled = this.config.systemOne?.enabled ?? false;

    // When System One is enabled, pass raw observation to gate before parsing
    if (systemOneEnabled && typeof input === 'string') {
      const result: PerceptionGateOutput = await gate.admit({
        sourceId: 'nar-io',
        source: 'user',
        rawObservation: input,
        sensorConfidence: 1.0,
        sourceQuality: 'GENERAL',
        correlationId: makeId(),
      });

      if (!result.admitted || !result.task) {
        this._eventBus?.emit('warning', {
          message: result.rejectionReason ?? 'Perception gate rejected input',
          term: input,
        });
        return;
      }

      // Adopt gate's calibrated truth and taskType
      const calibratedTruth = toTruth(
        result.task.truth ?? (result.task.taskType === 'belief' ? Truth.TRUE : undefined)
      );
      const calibratedType = result.task.taskType as TaskType;

      // Parse the term for memory storage
      const parsedTerm = termParser.parse(result.task.term);
      if (!parsedTerm) {
        this._eventBus?.emit('warning', {
          message: 'Failed to parse admitted term',
          term: result.task.term,
        });
        return;
      }

      this.commitAdmitted({
        term: parsedTerm,
        label: result.task.term,
        type: calibratedType,
        truth: calibratedTruth,
        prime: true,
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
      this._eventBus?.emit('warning', { message: validation.reason, term: parsedTerm.toString() });
      return;
    }

    await this.addTask(parsedTerm, type, truth ?? parsedTruth ?? Truth.TRUE);
  }

  async believe(input: string | Term, truth?: TruthType): Promise<void> {
    return this.input(input, 'belief', truth);
  }

  async goal(input: string | Term, truth?: TruthType): Promise<void> {
    return this.input(input, 'goal', truth);
  }

  async question(input: string | Term): Promise<void> {
    return this.input(input, 'question');
  }

  /**
   * Provide external reward feedback to update policy.
   * Goes through the RewardGate (epistemic firewall) and if accepted, updates the RLFPLearner.
   * @param reward - Reward value between -1 and 1
   * @param context - Optional context about what the reward is for
   */
  async reward(reward: number, context?: string): Promise<RewardGateOutput> {
    const clampedReward = Math.max(-1, Math.min(1, reward));
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
      if (concept.term) {
        const term = termParser.parse(concept.term);
        if (!term) continue;

        const result: PerceptionGateOutput = await this.perceptionGate.admit({
          sourceId: 'import',
          rawObservation: concept.term,
          sensorConfidence: 0.9,
          sourceQuality: concept.sourceQuality ?? 'GENERAL',
          correlationId: makeId(),
        });

        if (!result.admitted) {
          this._eventBus?.emit('warning', {
            message: result.rejectionReason ?? 'Perception gate rejected import',
            term: concept.term,
          });
          continue;
        }

        this.memory.addConcept(term);
      }
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
      this.import(state);
    }
  }

  private async addTask(
    term: Term,
    type: TaskType,
    truth: TruthType = Truth.NEUTRAL
  ): Promise<void> {
    const gate = this.perceptionGate;
    const systemOneEnabled = this.config.systemOne?.enabled ?? false;

    // When System One is enabled, use the gate's admit method which returns calibrated truth/taskType
    if (systemOneEnabled) {
      const result: PerceptionGateOutput = await gate.admit({
        sourceId: 'nar-io',
        source: 'derivation',
        rawObservation: term.toString(),
        sensorConfidence: truth.c ?? 0.5,
        sourceQuality: 'GENERAL',
        correlationId: makeId(),
      });

      if (!result.admitted || !result.task) {
        this._eventBus?.emit('warning', {
          message: result.rejectionReason ?? 'Perception gate rejected task',
          term: term.toString(),
        });
        return;
      }

      // Adopt gate's calibrated truth and taskType
      const calibratedTruth = toTruth(result.task.truth ?? truth);
      const calibratedType = result.task.taskType as TaskType;

      this.commitAdmitted({
        term,
        label: term.toString(),
        type: calibratedType,
        truth: calibratedTruth,
        prime: true,
      });
      return;
    }

    // Legacy path (System One disabled)
    const budget = createBudget(truth.f * truth.c);
    const wasNew = !this.memory.getConcept(term);

    const result: PerceptionGateOutput = await this.perceptionGate.admit({
      sourceId: 'nar-io',
      source: 'derivation',
      rawObservation: term.toString(),
      sensorConfidence: truth.c,
      sourceQuality: 'GENERAL',
      correlationId: makeId(),
    });

    if (!result.admitted || !result.task) {
      this._eventBus?.emit('warning', {
        message: result.rejectionReason ?? 'Perception gate rejected task',
        term: term.toString(),
      });
      return;
    }

    this.memory.addTask(term, type, truth, budget);

    if (wasNew && this._eventBus) {
      this._eventBus.emit('concept:created', {
        term,
        priority: budget.priority,
      });
      this._systemEventBus?.emit('nar:derivation', {
        term: term.toString(),
        confidence: truth.f,
        timestamp: Date.now(),
      });
    }

    if (this.cognitiveParams?.attention.autoPrime ?? true) {
      this.primeAttention(term);
    }
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
