/**
 * Schema Induction - Induces reusable schemas from successful derivation patterns
 *
 * From successful derivation patterns, induces reusable schemas:
 * - "If A→B and B→C then A→C" (transitivity schema)
 * - "If X causes Y and Y causes Z then X causes Z" (causal chain)
 * - Store as higher-order concepts with variables
 * - LM proposes, NARS validates, both adopt
 */

import { type BagItem, PriorityBag } from '../bag/Bag.js';
import type { LMService } from '../lm/lm-service.js';
import { createLogger, type Logger } from '@senars/core/logger';
import type { Memory } from '../memory';
import type { Term } from '../terms';
import { containsSubterm, getSubject, Truth } from '../terms';
import { createBudget, createTask, type Task } from '../types';
import type { RandomSource } from '../types/primitives.js';
import { clamp01, errMsg } from '../utils';
import { AIKRProcessor, PrioritySampling, type ProcessOptions, type AikrBagOptions } from './aikr-processor.js';

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
  private readonly memory: Memory;
  private readonly lmClient: LMService;
  private readonly config: SchemaInductionConfig;
  private readonly logger: Logger;
  private schemas = new Map<string, SchemaPattern>();
  private lastInductionTime = 0;
  private readonly rng: RandomSource;
  /** Phase C (REFACTOR.todo1): AIKR-bounded chain accumulation + processing. */
  readonly #chainBag = new PriorityBag<DerivationChainItem>({ capacity: 256 });
  readonly #processor: AIKRProcessor<DerivationChainItem, InductionResult>;
  readonly #seenSignatures = new Set<string>();

  constructor(memory: Memory, lmClient: LMService, config: Partial<SchemaInductionConfig> = {}) {
    this.memory = memory;
    this.lmClient = lmClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = config.rng ?? Math.random;
    this.logger = createLogger({ scope: 'learning:schema-induction' });
    this.#chainBag = new PriorityBag<DerivationChainItem>({
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
    const signature = chain.map((t) => t.term.toString()).join('→');
    if (this.#seenSignatures.has(signature)) return;
    this.#seenSignatures.add(signature);
    if (this.#seenSignatures.size > 4096) this.#seenSignatures.clear();
    this.#processor.admit({
      id: signature,
      priority: chain.length,
      chain: [...chain],
      signature,
    });
  }

  /** Micro-tick-compatible induction: inert below pressure 0.7, interruptible. */
  async induceIfPressured(
    options: ProcessOptions = {}
  ): Promise<InductionResult[]> {
    return this.#processor.processIfPressured(options);
  }

  /** Explicit drain (CLI `.schemas-induce`): ignores the pressure gate. */
  async induceNow(
    options: ProcessOptions = {}
  ): Promise<InductionResult[]> {
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
    const variables = chain.map((_, i) => `?V${i + 1}`);
    const template = chain.map((t, i) => `${variables[i]}:${t.term.toString()}`).join(' → ');
    const confidences = chain.map((t) => (t.truth ? t.truth.f * t.truth.c : 0));
    const confidence = clamp01(Math.min(...confidences));
    if (confidence < this.config.minConfidenceForInduction) return null;
    const id = `schema-sym-${Date.now()}-${this.rng().toString(36).slice(2, 8)}`;
    const schema: SchemaPattern = {
      id,
      template,
      variables,
      examples: [chain.map((t) => t.term.toString()).join(' → ')],
      confidence,
      usageCount: 0,
      lastUsed: Date.now(),
    };
    this.schemas.set(id, schema);
    this.enforceMaxSchemas();
    return { schema, instances: chain.map((t) => t.term.toString()), confidence };
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

  applySchema(schemaId: string, terms: Record<string, string>): Task | null {
    const schema = this.schemas.get(schemaId);
    if (!schema) return null;

    let result = schema.template;
    for (const [variable, value] of Object.entries(terms)) {
      result = result.replaceAll(variable, value);
    }

    schema.usageCount++;
    schema.lastUsed = Date.now();

    return createTask(
      { kind: 'atom' as const, symbol: result } as Term,
      'belief',
      Truth.create(0.7, schema.confidence * 0.8),
      createBudget(0.6, 0.7)
    );
  }

  private extractPatterns(derivations: Task[]): Task[][] {
    const chains: Task[][] = [];
    let current: Task[] = [];

    for (const d of derivations) {
      if (!d.truth) continue;
      const confidence = d.truth.f * d.truth.c;
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
    const chainStr = chain.map((t) => t.term.toString()).join(' → ');

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

    const id = `schema-${Date.now()}-${this.rng().toString(36).slice(2, 8)}`;
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

    return {
      schema,
      instances: chain.map((t) => t.term.toString()),
      confidence: parsed.confidence,
    };
  }

  private parseSchemaResponse(response: string): {
    pattern: string;
    type: string;
    confidence: number;
    variables: string[];
  } | null {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const obj = JSON.parse(jsonMatch[0]);
      if (!obj.pattern || !obj.variables) return null;
      return {
        pattern: obj.pattern,
        type: obj.type ?? 'unknown',
        confidence: clamp01(obj.confidence ?? 0.5),
        variables: obj.variables,
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
  memory: Memory,
  lmClient: LMService,
  config?: Partial<SchemaInductionConfig>
): SchemaInductor => {
  return new SchemaInductor(memory, lmClient, config);
};
