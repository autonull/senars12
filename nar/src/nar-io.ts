import { promises as fs } from 'node:fs';
import type { CognitiveParameters } from './config/cognitive-parameters.js';
import type { KernelPerceptionGate } from './kernel';
import { gateRegistry } from './kernel/GateRegistry.js';
import type { Memory } from './memory';
import type { NARConfig } from './nar';
import type { TaskManager } from './task';
import type { Term } from './terms';
import { Truth, termParser, validateTaskTerm } from './terms';
import type { Truth as TruthType } from './terms/truth.js';
import type { TaskType } from './types';
import { createBudget, type EventBus } from './types';
import type { EventBus as NarEventBus } from './types/events.js';
import type { PerceptionGateInput, PerceptionGateOutput } from '@senars/kernel/schemas';
import { seedTruth } from './lm/system-one/seed.js';
import type { SourceQuality } from '@senars/kernel/schemas';

function toTruth(t: TruthType | { frequency: number; confidence: number } | undefined): Truth {
  if (!t) return Truth.NEUTRAL;
  if ('f' in t && 'c' in t) return t as Truth;
  return Truth.create(t.frequency, t.confidence);
}

interface SerializedNARState {
  concepts: Array<{ term: string; priority: number }>;
  config: NARConfig;
  timestamp: string;
}

// Bare inheritance atoms, e.g. `(bird --> animal)` — substring match, mirroring
// the historical areTermsRelated semantics (nested compounds match their inner pair).
const INHERITANCE_ATOMS_RE = /\((\w+)\s+-->\s+(\w+)\)/;

export class NARIO {
  private _eventBus: EventBus | null = null;
  private _systemEventBus: NarEventBus | null = null;
  private cognitiveParams?: CognitiveParameters;
  private perceptionGate: KernelPerceptionGate;

  constructor(
    private readonly memory: Memory,
    private readonly taskManager: TaskManager,
    private readonly config: NARConfig
  ) {
    this.perceptionGate = gateRegistry.getPerceptionGate();
  }

  setcognitiveParams(params: CognitiveParameters): void {
    this.cognitiveParams = params;
  }

  setEventBus(eventBus: EventBus): void {
    this._eventBus = eventBus;
  }

  setSystemEventBus(bus: NarEventBus): void {
    this._systemEventBus = bus;
  }

  async input(input: string | Term, type: TaskType = 'belief', truth?: TruthType): Promise<void> {
    const gate = gateRegistry.getPerceptionGate();
    const systemOneEnabled = this.config.systemOne?.enabled ?? false;

    // When System One is enabled, pass raw observation to gate before parsing
    if (systemOneEnabled && typeof input === 'string') {
      const result: PerceptionGateOutput = await gate.admit({
        sourceId: 'nar-io',
        rawObservation: input,
        sensorConfidence: 1.0,
        sourceQuality: 'GENERAL',
        correlationId: crypto.randomUUID(),
      });

      if (!result.admitted || !result.task) {
        this._eventBus?.emit('warning', {
          message: result.rejectionReason ?? 'Perception gate rejected input',
          term: input,
        });
        return;
      }

      // Adopt gate's calibrated truth and taskType
      const calibratedTruth = toTruth(result.task.truth ?? (result.task.taskType === 'belief' ? Truth.TRUE : undefined));
      const calibratedType = result.task.taskType as TaskType;

      // Parse the term for memory storage
      const parsedTerm = termParser.parse(result.task.term);
      if (!parsedTerm) {
        this._eventBus?.emit('warning', { message: 'Failed to parse admitted term', term: result.task.term });
        return;
      }

      const budget = createBudget(calibratedTruth.f * calibratedTruth.c);
      const wasNew = !this.memory.getConcept(parsedTerm);

      this.memory.addTask(parsedTerm, calibratedType, calibratedTruth, budget);

      if (wasNew && this._eventBus) {
        this._eventBus.emit('concept:created', {
          term: parsedTerm,
          priority: budget.priority,
        });
        this._systemEventBus?.emit('nar:derivation', {
          term: result.task.term,
          confidence: calibratedTruth.f,
          timestamp: Date.now(),
        });
      }

      if (this.cognitiveParams?.attention.autoPrime ?? true) {
        this.primeAttention(parsedTerm);
      }
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
          sourceQuality: 'PRIMARY',
          correlationId: crypto.randomUUID(),
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
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
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

  private async addTask(term: Term, type: TaskType, truth: TruthType = Truth.NEUTRAL): Promise<void> {
    const gate = gateRegistry.getPerceptionGate();
    const systemOneEnabled = this.config.systemOne?.enabled ?? false;

    // When System One is enabled, use the gate's admit method which returns calibrated truth/taskType
    if (systemOneEnabled) {
      const result: PerceptionGateOutput = await gate.admit({
        sourceId: 'nar-io',
        rawObservation: term.toString(),
        sensorConfidence: truth.c ?? 0.5,
        sourceQuality: 'GENERAL',
        correlationId: crypto.randomUUID(),
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

      const budget = createBudget(calibratedTruth.f * calibratedTruth.c);
      const wasNew = !this.memory.getConcept(term);

      this.memory.addTask(term, calibratedType, calibratedTruth, budget);

      if (wasNew && this._eventBus) {
        this._eventBus.emit('concept:created', {
          term,
          priority: budget.priority,
        });
        this._systemEventBus?.emit('nar:derivation', {
          term: term.toString(),
          confidence: calibratedTruth.f,
          timestamp: Date.now(),
        });
      }

      if (this.cognitiveParams?.attention.autoPrime ?? true) {
        this.primeAttention(term);
      }
      return;
    }

    // Legacy path (System One disabled)
    const budget = createBudget(truth.f * truth.c);
    const wasNew = !this.memory.getConcept(term);

    const result: PerceptionGateOutput = await this.perceptionGate.admit({
      sourceId: 'nar-io',
      rawObservation: term.toString(),
      sensorConfidence: truth.c,
      sourceQuality: 'GENERAL',
      correlationId: crypto.randomUUID(),
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
      concept.priority = Math.min(maxPriority, concept.priority + primeBoost);
    }

    // Also boost concepts that share terms (simple relevance propagation).
    // The input term's atoms are loop-invariant: extract once, and skip the
    // O(N) scan entirely when the input isn't a bare inheritance term
    // (no concept could match, same as areTermsRelated returning false).
    if (params?.attention.structuralSimilarity ?? true) {
      const termStr = term.toString();
      const match1 = termStr.match(INHERITANCE_ATOMS_RE);
      if (!match1) return;
      const [, s1, p1] = match1;
      this.memory.forEachConcept((c) => {
        const cStr = c.term.toString();
        if (cStr === termStr) return;
        const match2 = cStr.match(INHERITANCE_ATOMS_RE);
        if (
          match2 &&
          (s1 === match2[1] || s1 === match2[2] || p1 === match2[1] || p1 === match2[2])
        ) {
          c.priority = Math.min(maxPriority, c.priority + relatedBoost);
        }
      });
    }
  }
}
