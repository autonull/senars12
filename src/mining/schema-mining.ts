/**
 * Schema Mining — Schema induction as a fold query over the event log.
 *
 * Ports SchemaInductor, DomainLearners, and AIKRProcessor into the mining lane.
 * Surprise is a first-class event.
 */

import type { Episode } from '@senars/types/episodic-memory';
import type { Term } from '../kernel/terms/term';
import type { Truth } from '../kernel/truth';
import type { Task } from '../types/task';
import type { RandomSource } from '../types/primitives';
import { createAikrBag, type AikrBagOptions, AIKRProcessor, BagPrioritySampling, type ProcessOptions, type BagSamplingStrategy } from '../learning/aikr-processor';
import { SchemaInductor, type SchemaPattern, type InductionResult, type DerivationChainItem, type SchemaInductionConfig } from '../learning/schema-induction';
import type { DomainLearner, DomainLearningEvent, LearnerDomain } from '../learning/domain-learners';
import type { TextGenerator } from '../ports';

// ============================================================================
// Types
// ============================================================================

/** Mining context from the log. */
export interface MiningContext {
  /** Get all log entries. */
  getLog: () => Episode[];
  /** Get derivation chains. */
  getDerivationChains: () => readonly Task[][];
  /** Get LM client for schema generation. */
  getLMClient: () => TextGenerator | null;
  /** Get memory reader. */
  getMemory: () => any; // MemoryReader
}

/** Schema mining configuration. */
export interface SchemaMiningConfig extends SchemaInductionConfig {
  /** Enable surprise detection. */
  enableSurprise: boolean;
  /** Surprise threshold. */
  surpriseThreshold: number;
  /** Domain learners. */
  domainLearners: DomainLearner[];
}

/** Default mining config. */
export const defaultMiningConfig: SchemaMiningConfig = {
  enableSchemaInduction: true,
  minDerivationSteps: 3,
  minConfidenceForInduction: 0.6,
  maxSchemas: 50,
  inductionIntervalMs: 300_000,
  capacity: 256,
  pressureThreshold: 0.7,
  enableSurprise: true,
  surpriseThreshold: 0.5,
  domainLearners: [],
};

/** Mining event. */
export interface MiningEvent {
  type: 'schema_induced' | 'surprise' | 'domain_learned' | 'pattern_found';
  timestamp: number;
  data: any;
}

/** Schema miner — fold query over the log. */
export class SchemaMiner {
  private readonly context: MiningContext;
  private readonly config: SchemaMiningConfig;
  private readonly inducer: SchemaInductor;
  private readonly domainLearners: DomainLearner[];
  private readonly eventLog: MiningEvent[] = [];
  private lastMiningTime = 0;

  constructor(context: MiningContext, config: Partial<SchemaMiningConfig> = {}) {
    this.context = context;
    this.config = { ...defaultMiningConfig, ...config };

    const memory = context.getMemory();
    const lmClient = context.getLMClient();

    this.inducer = new SchemaInductor(
      memory,
      lmClient ?? { generateText: async () => '' } as TextGenerator,
      this.config
    );

    this.domainLearners = this.config.domainLearners;
  }

  /** Admit a derivation chain for induction (fold query). */
  admitDerivationChain(chain: readonly Task[]): void {
    this.inducer.onDerivation(chain);

    // Check for surprise
    if (this.config.enableSurprise) {
      this.checkSurprise(chain);
    }
  }

  /** Check for surprise in a derivation chain. */
  private checkSurprise(chain: readonly Task[]): void {
    // Surprise = unexpected outcome / high novelty
    const lastTask = chain[chain.length - 1];
    if (!lastTask) return;

    const truth = lastTask.truth;
    // Low confidence but high frequency = surprise
    const surpriseScore = truth.f * (1 - truth.c);

    if (surpriseScore > this.config.surpriseThreshold) {
      this.emitEvent({
        type: 'surprise',
        timestamp: Date.now(),
        data: { chain: chain.map(t => t.term.toString()), surpriseScore, lastTruth: truth },
      });
    }
  }

  /** Run induction if pressured (AIKR gate). */
  async induceIfPressured(options: ProcessOptions = {}): Promise<InductionResult[]> {
    const results = await this.inducer.induceIfPressured(options);

    for (const result of results) {
      this.emitEvent({
        type: 'schema_induced',
        timestamp: Date.now(),
        data: { schema: result.schema, instances: result.instances },
      });
    }

    return results;
  }

  /** Force induction (ignores pressure gate). */
  async induceNow(options: ProcessOptions = {}): Promise<InductionResult[]> {
    const results = await this.inducer.induceNow(options);

    for (const result of results) {
      this.emitEvent({
        type: 'schema_induced',
        timestamp: Date.now(),
        data: { schema: result.schema, instances: result.instances },
      });
    }

    return results;
  }

  /** Learn from domain events. */
  learnDomain(event: DomainLearningEvent): void {
    for (const learner of this.domainLearners) {
      try {
        learner.learn(event);
      } catch (e) {
        // Cross-domain error, skip
      }
    }

    this.emitEvent({
      type: 'domain_learned',
      timestamp: Date.now(),
      data: { domain: event.domain, reward: event.reward },
    });
  }

  /** Run a mining cycle. */
  async runCycle(): Promise<{
    schemas: InductionResult[];
    events: MiningEvent[];
    surpriseCount: number;
  }> {
    const now = Date.now();
    const schemas = await this.induceIfPressured();

    // Learn from recent log events
    await this.learnFromLog();

    const events = this.eventLog.slice(this.lastMiningTime);
    this.lastMiningTime = now;

    const surpriseCount = events.filter(e => e.type === 'surprise').length;

    return { schemas, events, surpriseCount };
  }

  /** Learn from log entries. */
  private async learnFromLog(): Promise<void> {
    const log = this.context.getLog();

    for (const entry of log) {
      const meta = entry.metadata as Record<string, unknown> | undefined;
      if (meta && meta.type === 'reward') {
        this.learnDomain({
          domain: meta.domain as LearnerDomain,
          reward: meta.reward as number,
          key: meta.key as string,
        });
      }
    }
  }

  /** Get induced schemas. */
  getSchemas(): SchemaPattern[] {
    // Access private schemas via inducer (would need public accessor)
    return [];
  }

  /** Get mining events. */
  getEvents(since?: number): MiningEvent[] {
    if (!since) return [...this.eventLog];
    return this.eventLog.filter(e => e.timestamp > since);
  }

  /** Emit a mining event. */
  private emitEvent(event: MiningEvent): void {
    this.eventLog.push(event);
  }

  /** Decay chains (call per cycle). */
  decayChains(rate?: number): void {
    this.inducer.decayChains(rate);
  }

  /** Get stats. */
  getStats(): {
    chainsPending: number;
    schemasInduced: number;
    eventsLogged: number;
    lastMiningTime: number;
  } {
    return {
      chainsPending: 0, // Would need access to inducer's bag
      schemasInduced: this.eventLog.filter(e => e.type === 'schema_induced').length,
      eventsLogged: this.eventLog.length,
      lastMiningTime: this.lastMiningTime,
    };
  }
}

/** Create a schema miner from a mining context. */
export function createSchemaMiner(
  context: MiningContext,
  config?: Partial<SchemaMiningConfig>
): SchemaMiner {
  return new SchemaMiner(context, config);
}

/** Surprise event — first-class event for unexpected outcomes. */
export interface SurpriseEvent {
  id: string;
  type: 'surprise';
  timestamp: number;
  /** What was surprising. */
  description: string;
  /** Surprise score [0,1]. */
  score: number;
  /** Context. */
  context: Record<string, unknown>;
  /** Suggested response. */
  suggestedResponse: 'induce_schema' | 'investigate' | 'adjust_prior' | 'alert';
}

/** Detect surprise from log entries. */
export function detectSurprise(
  log: Episode[],
  threshold = 0.5
): SurpriseEvent[] {
  const surprises: SurpriseEvent[] = [];

  for (const entry of log) {
    // Check for unexpected outcomes
    if (entry.type === 'belief_added' || entry.type === 'reaction') {
      const outcome = entry.metadata as { expected?: boolean; confidence?: number; utility?: number } | undefined;
      if (outcome) {
        const expected = outcome.expected ?? true;
        const confidence = outcome.confidence ?? 1;
        const utility = outcome.utility ?? 0;

        if (!expected && confidence < threshold) {
          surprises.push({
            id: `surprise-${entry.id}`,
            type: 'surprise',
            timestamp: entry.timestamp,
            description: `Unexpected ${entry.type} with low confidence`,
            score: 1 - confidence,
            context: { entryId: entry.id, entryType: entry.type },
            suggestedResponse: 'induce_schema',
          });
        }

        // High utility surprise
        if (utility > 10 && confidence < 0.7) {
          surprises.push({
            id: `surprise-${entry.id}-utility`,
            type: 'surprise',
            timestamp: entry.timestamp,
            description: `High utility outcome with low confidence`,
            score: utility / 20,
            context: { entryId: entry.id, utility },
            suggestedResponse: 'induce_schema',
          });
        }
      }
    }
  }

  return surprises;
}

/** Pattern found event. */
export interface PatternEvent {
  id: string;
  type: 'pattern_found';
  timestamp: number;
  pattern: string;
  frequency: number;
  confidence: number;
  examples: string[];
}

/** Find patterns in derivation chains. */
export function findPatterns(
  chains: Task[][],
  minFrequency = 2
): PatternEvent[] {
  const patternCounts = new Map<string, { count: number; examples: string[] }>();

  for (const chain of chains) {
    const signature = chain.map(t => t.term.toString()).join(' → ');
    const entry = patternCounts.get(signature) ?? { count: 0, examples: [] };
    entry.count++;
    entry.examples.push(signature);
    patternCounts.set(signature, entry);
  }

  const patterns: PatternEvent[] = [];
  for (const [pattern, { count, examples }] of patternCounts) {
    if (count >= minFrequency) {
      patterns.push({
        id: `pattern-${Date.now()}-${patterns.length}`,
        type: 'pattern_found',
        timestamp: Date.now(),
        pattern,
        frequency: count,
        confidence: Math.min(1, count / 10),
        examples: examples.slice(0, 5),
      });
    }
  }

  return patterns;
}

/** Domain learning event from mining. */
export interface DomainLearningEventMining extends DomainLearningEvent {
  /** Mining-specific fields. */
  miningContext: {
    iteration: number;
    schemaInduced: boolean;
    surpriseDetected: boolean;
  };
}

/** Run domain learners from mining events. */
export function runDomainLearners(
  learners: DomainLearner[],
  events: DomainLearningEventMining[]
): void {
  for (const event of events) {
    for (const learner of learners) {
      if (learner.domain === event.domain) {
        try {
          learner.learn(event);
        } catch {
          // Ignore cross-domain errors
        }
      }
    }
  }
}

/** AIKR processor for mining (shared with schema induction). */
export interface MiningAikrConfig {
  /** Bag capacity. */
  capacity?: number;
  /** Forget rate. */
  forgetRate?: number;
  /** Pressure threshold. */
  pressureThreshold?: number;
  /** Sampling strategy. */
  samplingStrategy: BagSamplingStrategy<any>;
  /** Process function. */
  process: (items: any[], signal?: AbortSignal) => any[] | Promise<any[]>;
  /** RNG. */
  rng?: RandomSource;
}

/** Create a mining AIKR processor. */
export function createMiningProcessor<T extends { id: string; priority: number }>(
  config: MiningAikrConfig
): AIKRProcessor<T, any> {
  const bag = createAikrBag<T>({
    capacity: config.capacity ?? 256,
    forgetRate: config.forgetRate,
    pressureThreshold: config.pressureThreshold,
    rng: config.rng,
  });

  return new AIKRProcessor<T, any>({
    bag,
    samplingStrategy: config.samplingStrategy,
    pressureThreshold: config.pressureThreshold ?? 0.7,
    rng: config.rng,
    process: config.process,
  });
}