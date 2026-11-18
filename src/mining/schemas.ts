/**
 * Mining Schemas — schema extraction from logs and artifacts.
 *
 * Extracts structural patterns from execution logs for learning.
 */

import type { Term } from '../kernel/terms/term.js';
import type { TruthValue } from '../kernel/truth.js';
import type { Stamp } from '../kernel/types.js';

/** Convert term to string key. */
function termToKey(term: Term): string {
  return JSON.stringify(term);
}

/** Mined schema. */
export interface MinedSchema {
  /** Schema ID. */
  id: string;
  /** Pattern type. */
  type: 'sequence' | 'association' | 'causal' | 'hierarchical' | 'temporal';
  /** Pattern description. */
  description: string;
  /** Supporting examples. */
  examples: SchemaExample[];
  /** Confidence. */
  confidence: number;
  /** Support count. */
  support: number;
  /** Schema terms. */
  terms: Term[];
  /** Metadata. */
  metadata: Record<string, unknown>;
}

/** Schema example. */
export interface SchemaExample {
  /** Example ID. */
  id: string;
  /** Terms involved. */
  terms: Term[];
  /** Truth values. */
  truths: TruthValue[];
  /** Timestamps. */
  timestamps: number[];
  /** Context. */
  context: Record<string, unknown>;
}

/** Schema mining config. */
export interface MiningConfig {
  /** Minimum support. */
  minSupport: number;
  /** Minimum confidence. */
  minConfidence: number;
  /** Maximum pattern length. */
  maxPatternLength: number;
  /** Time window (ms). */
  timeWindow: number;
  /** Enable temporal mining. */
  temporal: boolean;
  /** Enable causal mining. */
  causal: boolean;
}

/** Default mining config. */
export const defaultMiningConfig: MiningConfig = {
  minSupport: 3,
  minConfidence: 0.7,
  maxPatternLength: 5,
  timeWindow: 24 * 60 * 60 * 1000, // 24 hours
  temporal: true,
  causal: true,
};

/** Schema miner. */
export class SchemaMiner {
  private config: MiningConfig;
  private schemas: Map<string, MinedSchema> = new Map();

  constructor(config: MiningConfig = defaultMiningConfig) {
    this.config = config;
  }

  /** Mine schemas from log entries. */
  mine(
    entries: LogEntry[],
    existingSchemas: MinedSchema[] = []
  ): MinedSchema[] {
    const newSchemas: MinedSchema[] = [];

    // Mine sequential patterns
    const sequences = this.mineSequences(entries);
    newSchemas.push(...sequences);

    // Mine associations
    const associations = this.mineAssociations(entries);
    newSchemas.push(...associations);

    // Mine causal patterns
    if (this.config.causal) {
      const causal = this.mineCausal(entries);
      newSchemas.push(...causal);
    }

    // Mine hierarchical patterns
    const hierarchical = this.mineHierarchical(entries);
    newSchemas.push(...hierarchical);

    // Filter by thresholds
    const filtered = newSchemas.filter(s =>
      s.support >= this.config.minSupport &&
      s.confidence >= this.config.minConfidence
    );

    // Merge with existing
    for (const schema of filtered) {
      const existing = existingSchemas.find(e => this.schemasEqual(e, schema));
      if (existing) {
        this.mergeSchemas(existing, schema);
      } else {
        this.schemas.set(schema.id, schema);
      }
    }

    return filtered;
  }

  /** Mine sequential patterns. */
  private mineSequences(entries: LogEntry[]): MinedSchema[] {
    const schemas: MinedSchema[] = [];
    const sequences = new Map<string, LogEntry[]>();

    // Group by correlation ID
    for (const entry of entries) {
      if (!entry.correlationId) continue;
      const seq = sequences.get(entry.correlationId) ?? [];
      seq.push(entry);
      sequences.set(entry.correlationId, seq);
    }

    // Find frequent subsequences
    for (const [corrId, seq] of sequences) {
      if (seq.length < 2) continue;

      for (let len = 2; len <= Math.min(this.config.maxPatternLength, seq.length); len++) {
        for (let i = 0; i <= seq.length - len; i++) {
          const subseq = seq.slice(i, i + len);
          const key = subseq.map(e => e.term).join(' -> ');
          const existing = schemas.find(s => s.id === key);
          if (existing) {
            existing.support++;
            existing.examples.push(this.entryToExample(subseq));
          } else {
            schemas.push({
              id: `seq-${key}`,
              type: 'sequence',
              description: `Sequence: ${key}`,
              examples: [this.entryToExample(subseq)],
              confidence: 1.0,
              support: 1,
              terms: subseq.map(e => e.term),
              metadata: { correlationId: corrId, length: len },
            });
          }
        }
      }
    }

    return schemas;
  }

  /** Mine association patterns. */
  private mineAssociations(entries: LogEntry[]): MinedSchema[] {
    const schemas: MinedSchema[] = [];
    const cooccurrence = new Map<string, Map<string, number>>();

    // Build co-occurrence matrix
    for (const entry of entries) {
      if (!entry.correlationId) continue;
      const terms = entries
        .filter(e => e.correlationId === entry.correlationId && e.id !== entry.id)
        .map(e => e.term);

      const key = termToKey(entry.term);
      for (const term of terms) {
        const termKey = termToKey(term);
        const map = cooccurrence.get(key) ?? new Map();
        map.set(termKey, (map.get(termKey) ?? 0) + 1);
        cooccurrence.set(key, map);
      }
    }

    // Find strong associations
    for (const [termA, related] of cooccurrence) {
      for (const [termB, count] of related) {
        if (count >= this.config.minSupport) {
          const confidence = count / entries.filter(e => termToKey(e.term) === termA).length;
          if (confidence >= this.config.minConfidence) {
            schemas.push({
              id: `assoc-${termA}-${termB}`,
              type: 'association',
              description: `Association: ${termA} -> ${termB}`,
              examples: [],
              confidence,
              support: count,
              terms: [termA, termB] as any,
              metadata: { termA, termB },
            });
          }
        }
      }
    }

    return schemas;
  }

  /** Mine causal patterns. */
  private mineCausal(entries: LogEntry[]): MinedSchema[] {
    const schemas: MinedSchema[] = [];

    // Look for temporal precedence with high correlation
    for (let i = 0; i < entries.length - 1; i++) {
      const cause = entries[i]!;
      const effect = entries[i + 1]!;

      if (!cause.correlationId || cause.correlationId !== effect.correlationId) continue;
      if (cause.timestamp >= effect.timestamp) continue;

      const key = `causal-${cause.term}-${effect.term}`;
      const existing = schemas.find(s => s.id === key);
      if (existing) {
        existing.support++;
      } else {
        schemas.push({
          id: key,
          type: 'causal',
          description: `Causal: ${cause.term} -> ${effect.term}`,
          examples: [this.entryToExample([cause, effect])],
          confidence: 0.8, // Base confidence
          support: 1,
          terms: [cause.term, effect.term],
          metadata: { cause: cause.term, effect: effect.term },
        });
      }
    }

    return schemas;
  }

  /** Mine hierarchical patterns. */
  private mineHierarchical(entries: LogEntry[]): MinedSchema[] {
    const schemas: MinedSchema[] = [];
    const hierarchy = new Map<string, Set<string>>();

    // Build hierarchy from compound terms
    for (const entry of entries) {
      // Simplified: extract parent-child from term structure
      // In real implementation, analyze term composition
    }

    return schemas;
  }

  /** Convert log entry to schema example. */
  private entryToExample(entries: LogEntry[]): SchemaExample {
    return {
      id: `ex-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      terms: entries.map(e => e.term),
      truths: entries.map(e => e.truth),
      timestamps: entries.map(e => e.timestamp),
      context: {},
    };
  }

  /** Check if two schemas are equal. */
  private schemasEqual(a: MinedSchema, b: MinedSchema): boolean {
    return a.type === b.type && a.terms.length === b.terms.length &&
      a.terms.every((t, i) => t === b.terms[i]);
  }

  /** Merge schemas. */
  private mergeSchemas(target: MinedSchema, source: MinedSchema): void {
    target.support += source.support;
    target.confidence = (target.confidence * (target.support - source.support) + source.confidence * source.support) / target.support;
    target.examples.push(...source.examples);
  }

  /** Get all mined schemas. */
  getSchemas(): MinedSchema[] {
    return Array.from(this.schemas.values());
  }

  /** Get schema by ID. */
  getSchema(id: string): MinedSchema | undefined {
    return this.schemas.get(id);
  }
}

/** Log entry for mining. */
export interface LogEntry {
  /** Entry ID. */
  id: string;
  /** Term. */
  term: Term;
  /** Truth value. */
  truth: TruthValue;
  /** Timestamp. */
  timestamp: number;
  /** Correlation ID. */
  correlationId?: string;
  /** Event type. */
  eventType: string;
}

/** Create a schema miner. */
export function createSchemaMiner(config?: MiningConfig): SchemaMiner {
  return new SchemaMiner(config);
}