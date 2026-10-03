/**
 * Schema Induction - Induces reusable schemas from successful derivation patterns
 *
 * From successful derivation patterns, induces reusable schemas:
 * - "If A→B and B→C then A→C" (transitivity schema)
 * - "If X causes Y and Y causes Z then X causes Z" (causal chain)
 * - Store as higher-order concepts with variables
 * - LM proposes, NARS validates, both adopt
 */

import {
  clamp01,
  createLogger,
  errMsg,
  generateId,
  type Logger,
  LruCache,
  parseJsonObject,
} from '@senars/util';
import type { BagItem } from '../bag/Bag.js';
import type { MemoryReader } from '../memory/ports/index.js';
import type { TextGenerator } from '../ports';
import type { Term } from '../terms';
import { containsSubterm, getSubject, Truth, termKey } from '../terms';
import { createTask, createTaskWeight, type Task } from '../types';
import type { RandomSource } from '../types/primitives.js';

/** Serialized chain terms — the single rendering behind signatures, templates, and instances. */
const chainTerms = (chain: readonly Task[]): string[] => chain.map((t) => t.term.toString());

/**
 * Canonical identity of a chain, for novelty dedup only. The rendered signature
 * is what a human reads and what a schema is named by, so it cannot double as
 * the dedup key: two chains whose terms serialize alike would collapse into one.
 */
const chainIdentity = (chain: readonly Task[]): string =>
  chain.map((t) => termKey(t.term)).join('→');

import {
  AIKRProcessor,
  type AikrBagOptions,
  createAikrBag,
  PrioritySampling,
  type ProcessOptions,
} from './aikr-processor.js';

export interface SchemaPattern {
  id: string;
  template: string;
  variables: string[];
  examples: string[];
  confidence: number;
  usageCount: number;
  lastUsed: number;
}

export interface InductionResult {
  schema: SchemaPattern;
  instances: string[];
  confidence: number;
}

/** Bag item for a derivation chain awaiting induction (Phase C). */
export interface DerivationChainItem extends BagItem {
  chain: Task[];
  signature: string;
}

export interface SchemaInductionConfig extends AikrBagOptions {
  enableSchemaInduction: boolean;
  minDerivationSteps: number;
  minConfidenceForInduction: number;
  maxSchemas: number;
  inductionIntervalMs: number;
}

const DEFAULT_CONFIG: SchemaInductionConfig = {
  enableSchemaInduction: true,
  minDerivationSteps: 3,
  minConfidenceForInduction: 0.6,
  maxSchemas: 50,
  inductionIntervalMs: 300_000,
  capacity: 256,
  pressureThreshold: 0.7,
};

export class SchemaInductor {
  private readonly memory: MemoryReader;
  private readonly lmClient: TextGenerator;
  private readonly config: SchemaInductionConfig;
  private readonly logger: Logger;
  private schemas = new Map<string, SchemaPattern>();
  private lastInductionTime = 0;
  private readonly rng: RandomSource;
  /** Phase C (REFACTOR.todo1): AIKR-bounded chain accumulation + processing. */
  readonly #chainBag = createAikrBag<DerivationChainItem>({ capacity: 256 });
  readonly #processor: AIKRProcessor<DerivationChainItem, InductionResult>;
  static readonly #SEEN_SIGNATURE_CAP = 4096;
  readonly #seenSignatures = new LruCache<string, true>(SchemaInductor.#SEEN_SIGNATURE_CAP);

  constructor(
    memory: MemoryReader,
    lmClient: TextGenerator,
    config: Partial<SchemaInductionConfig> = {}
  ) {
    this.memory = memory;
    this.lmClient = lmClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = config.rng ?? Math.random;
    this.logger = createLogger({ scope: 'learning:schema-induction' });
    this.#chainBag = createAikrBag<DerivationChainItem>({
      capacity: this.config.capacity ?? 256,
      forgetRate: this.config.forgetRate,
      rng: this.rng,
    });
    this.#processor = new AIKRProcessor<DerivationChainItem, InductionResult>({
      bag: this.#chainBag,
      samplingStrategy: new PrioritySampling(1.0),
      pressureThreshold: this.config.pressureThreshold ?? 0.7,
      rng: this.rng,
      process: (items, signal) => this.#induceChains(items, signal),
    });
  }

  /** Phase C: continuous admission from the derivation-chain sink (novelty × length). */
  onDerivation(chain: readonly Task[]): void {
    if (!this.config.enableSchemaInduction || chain.length === 0) return;
    const identity = chainIdentity(chain);
    if (this.#seenSignatures.has(identity)) return;
    this.#seenSignatures.set(identity, true);
    const signature = chainTerms(chain).join('→');
    this.#processor.admit({
      id: signature,
      priority: chain.length,
      chain: [...chain],
      signature,
    });
  }

  /** Micro-tick-compatible induction: inert below pressure 0.7, interruptible. */
  async induceIfPressured(options: ProcessOptions = {}): Promise<InductionResult[]> {
    return this.#processor.processIfPressured(options);
  }

  /** Explicit drain (CLI `.schemas-induce`): ignores the pressure gate. */
  async induceNow(options: ProcessOptions = {}): Promise<InductionResult[]> {
    return this.#processor.process(options);
  }

  /** Phase C: decay stale chains (call per cycle). */
  decayChains(rate?: number): void {
    this.#processor.decay(rate);
  }

  get chainPressure(): number {
    return this.#processor.pressure();
  }

  async #induceChains(
    items: DerivationChainItem[],
    signal?: AbortSignal
  ): Promise<InductionResult[]> {
    const results: InductionResult[] = [];
    for (const item of items) {
      if (signal?.aborted) break;
      try {
        const induced = await this.induceSchema(item.chain);
        if (induced) {
          results.push(induced);
          continue;
        }
        // LM returned nothing parseable → symbolic structural induction.
        const symbolic = this.#symbolicInduction(item.chain);
        if (symbolic) results.push(symbolic);
      } catch {
        // LM unavailable/failed → symbolic structural induction fallback.
        const symbolic = this.#symbolicInduction(item.chain);
        if (symbolic) results.push(symbolic);
      }
    }
    return results;
  }

  /** Deterministic structural induction — no LM: abstract chain terms into variables. */
  #symbolicInduction(chain: Task[]): InductionResult | null {
    if (chain.length < this.config.minDerivationSteps) return null;
    const terms = chainTerms(chain);
    const variables = terms.map((_, i) => `?V${i + 1}`);
    const template = terms.map((t, i) => `${variables[i]}:${t}`).join(' → ');
    const confidences = chain.map((t) => (t.truth ? Truth.attention(t.truth) : 0));
    const confidence = clamp01(Math.min(...confidences));
    if (confidence < this.config.minConfidenceForInduction) return null;
    const id = generateId('schema-sym', this.rng);
    const schema: SchemaPattern = {
      id,
      template,
      variables,
      examples: [terms.join(' → ')],
      confidence,
      usageCount: 0,
      lastUsed: Date.now(),
    };
    this.schemas.set(id, schema);
    this.enforceMaxSchemas();
    return { schema, instances: terms, confidence };
  }

  async induceFromDerivations(derivations: Task[]): Promise<InductionResult[]> {
    if (!this.config.enableSchemaInduction || derivations.length === 0) return [];

    const now = Date.now();
    if (now - this.lastInductionTime < this.config.inductionIntervalMs) return [];
    this.lastInductionTime = now;

    const patterns = this.extractPatterns(derivations);
    if (patterns.length === 0) return [];

    const results: InductionResult[] = [];
    for (const pattern of patterns) {
      try {
        const induced = await this.induceSchema(pattern);
        if (induced) results.push(induced);
      } catch (error) {
        this.logger.warn(`Schema induction failed: ${errMsg(error)}`);
      }
    }

    return results;
  }

  getSchemas(): SchemaPattern[] {
    return Array.from(this.schemas.values());
  }

  getSchema(id: string): SchemaPattern | undefined {
    return this.schemas.get(id);
  }

  private extractPatterns(derivations: Task[]): Task[][] {
    const chains: Task[][] = [];
    let current: Task[] = [];

    for (const d of derivations) {
      if (!d.truth) continue;
      const confidence = Truth.attention(d.truth);
      if (confidence < this.config.minConfidenceForInduction) continue;

      if (current.length > 0) {
        const lastTask = current[current.length - 1]!;
        const subject = getSubject(d.term);
        if (
          containsSubterm(d.term, lastTask.term) ||
          (subject && containsSubterm(lastTask.term, subject))
        ) {
          current.push(d);
          continue;
        }
      }
      if (current.length >= this.config.minDerivationSteps) {
        chains.push(current);
      }
      current = [d];
    }
    if (current.length >= this.config.minDerivationSteps) chains.push(current);

    return chains;
  }

  private async induceSchema(chain: Task[]): Promise<InductionResult | null> {
    const chainStr = chainTerms(chain).join(' → ');

    const prompt = `Analyze this derivation chain and extract a reusable schema pattern.

Chain: ${chainStr}

Identify:
1. The general pattern (use variables like ?A, ?B, ?C for specific terms)
2. What type of reasoning pattern this is
3. How confident you are this is a reusable schema

Respond with JSON:
{
  "pattern": "(?A --> ?B) & (?B --> ?C) ==> (?A --> ?C)",
  "type": "transitivity",
  "confidence": 0.8,
  "variables": ["?A", "?B", "?C"]
}`;

    const response = await this.lmClient.generateText(prompt);
    const parsed = this.parseSchemaResponse(response);
    if (!parsed) return null;

    const id = generateId('schema', this.rng);
    const schema: SchemaPattern = {
      id,
      template: parsed.pattern,
      variables: parsed.variables,
      examples: [chainStr],
      confidence: parsed.confidence,
      usageCount: 0,
      lastUsed: Date.now(),
    };

    this.schemas.set(id, schema);
    this.enforceMaxSchemas();

    return { schema, instances: chainTerms(chain), confidence: parsed.confidence };
  }

  private parseSchemaResponse(response: string): {
    pattern: string;
    type: string;
    confidence: number;
    variables: string[];
  } | null {
    try {
      const obj = parseJsonObject(response) as Record<string, unknown> | null;
      if (typeof obj?.pattern !== 'string' || !Array.isArray(obj.variables)) return null;
      return {
        pattern: obj.pattern,
        type: typeof obj.type === 'string' ? obj.type : 'unknown',
        confidence: clamp01(typeof obj.confidence === 'number' ? obj.confidence : 0.5),
        variables: obj.variables.filter((v): v is string => typeof v === 'string'),
      };
    } catch {
      return null;
    }
  }

  private enforceMaxSchemas(): void {
    if (this.schemas.size <= this.config.maxSchemas) return;
    const sorted = Array.from(this.schemas.values()).sort(
      (a, b) => a.usageCount - b.usageCount || a.confidence - b.confidence
    );
    const toRemove = sorted.slice(0, this.schemas.size - this.config.maxSchemas);
    for (const s of toRemove) {
      this.schemas.delete(s.id);
    }
  }
}

export const createSchemaInductor = (
  memory: MemoryReader,
  lmClient: TextGenerator,
  config?: Partial<SchemaInductionConfig>
): SchemaInductor => {
  return new SchemaInductor(memory, lmClient, config);
};
