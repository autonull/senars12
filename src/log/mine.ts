/**
 * Log Mining — extract patterns, surprises, and procedural schemas from the log.
 *
 * Mining operates on the event log to discover:
 * - Surprise events (unexpected derivations, gate failures)
 * - Recurring derivation patterns (procedural schemas)
 * - Term co-occurrence and causal structure
 */

import { createHash } from 'crypto';
import type { LogEntry, CognitiveEvent } from './events.js';
import type { LogStore } from './store.js';
import { isGateFailedEvent, isDerivationAcceptedEvent, isDerivationMadeEvent } from './events.js';
import { query } from './query.js';

/** A surprise event detected in the log. */
export interface SurpriseEvent {
  /** Sequence number of the surprising event. */
  seq: number;
  /** Type of surprise. */
  kind: 'unexpected-derivation' | 'gate-failure' | 'confidence-violation' | 'novel-term' | 'pattern-break';
  /** Human-readable description. */
  description: string;
  /** The event that triggered the surprise. */
  trigger: LogEntry;
  /** Context events (before/after). */
  context: LogEntry[];
  /** Surprise score (0-1). */
  score: number;
}

/** A procedural schema mined from derivation patterns. */
export interface ProceduralSchema {
  /** Unique schema ID. */
  id: string;
  /** Premise pattern (term templates with variables). */
  premises: TermTemplate[];
  /** Conclusion template. */
  conclusion: TermTemplate;
  /** Rule sequence that produces this pattern. */
  ruleSequence: string[];
  /** Support: how many times observed. */
  support: number;
  /** Confidence: success rate. */
  confidence: number;
  /** First seen sequence. */
  firstSeen: number;
  /** Last seen sequence. */
  lastSeen: number;
}

/** Term template with variables. */
export interface TermTemplate {
  /** Template string with $VAR placeholders. */
  template: string;
  /** Variable bindings observed. */
  bindings: Map<string, string[]>;
}

/** Mining configuration. */
export interface MiningConfig {
  /** Minimum support for a schema. */
  minSupport: number;
  /** Minimum confidence for a schema. */
  minConfidence: number;
  /** Maximum pattern length. */
  maxPatternLength: number;
  /** Surprise threshold. */
  surpriseThreshold: number;
  /** Context window for surprises. */
  contextWindow: number;
}

/** Default mining configuration. */
export const defaultMiningConfig: MiningConfig = {
  minSupport: 3,
  minConfidence: 0.7,
  maxPatternLength: 5,
  surpriseThreshold: 0.8,
  contextWindow: 10,
};

/** Mine surprise events from the log. */
export async function mineSurprises(
  store: LogStore,
  config: Partial<MiningConfig> = {}
): Promise<SurpriseEvent[]> {
  const { surpriseThreshold, contextWindow } = { ...defaultMiningConfig, ...config };
  const surprises: SurpriseEvent[] = [];

  // 1. Gate failures
  const gateFailures = await query(store, {
    filter: { field: 'event.type', op: { eq: 'gate.failed' } },
    limit: 1000,
  });
  for (const entry of gateFailures.results) {
    if (isGateFailedEvent(entry.event)) {
      const context = await getContext(store, entry.seq, contextWindow);
      surprises.push({
        seq: entry.seq,
        kind: 'gate-failure',
        description: `Gate ${entry.event.payload.gate} failed`,
        trigger: entry,
        context,
        score: 0.9,
      });
    }
  }

  // 2. Confidence violations (truth > 0.99 or < 0.01)
  const derivations = await query(store, {
    filter: { field: 'event.type', op: { eq: 'derivation.accepted' } },
    limit: 5000,
  });
  for (const entry of derivations.results) {
    if (isDerivationAcceptedEvent(entry.event)) {
      const truth = entry.event.payload.truth;
      if (truth && (truth.frequency > 0.99 || truth.frequency < 0.01 || truth.confidence > 0.99 || truth.confidence < 0.01)) {
        const context = await getContext(store, entry.seq, contextWindow);
        surprises.push({
          seq: entry.seq,
          kind: 'confidence-violation',
          description: `Extreme truth value: f=${truth.frequency}, c=${truth.confidence}`,
          trigger: entry,
          context,
          score: Math.max(truth.frequency, 1 - truth.frequency, truth.confidence, 1 - truth.confidence),
        });
      }
    }
  }

  // 3. Novel terms (first occurrence of a term structure)
  const termStructures = new Map<string, number>();
  const derivationMade = await query(store, {
    filter: { field: 'event.type', op: { eq: 'derivation.made' } },
    limit: 5000,
  });
  for (const entry of derivationMade.results) {
    if (isDerivationMadeEvent(entry.event)) {
      for (const premise of entry.event.payload.premises) {
        const struct = getTermStructure(premise);
        if (!termStructures.has(struct)) {
          termStructures.set(struct, entry.seq);
          const context = await getContext(store, entry.seq, contextWindow);
          surprises.push({
            seq: entry.seq,
            kind: 'novel-term',
            description: `Novel term structure: ${struct}`,
            trigger: entry,
            context,
            score: 0.7,
          });
        }
      }
      const conclusionStruct = getTermStructure(entry.event.payload.conclusion);
      if (!termStructures.has(conclusionStruct)) {
        termStructures.set(conclusionStruct, entry.seq);
      }
    }
  }

  // Filter by threshold
  return surprises.filter(s => s.score >= surpriseThreshold);
}

/** Get context events around a sequence. */
async function getContext(store: LogStore, seq: number, window: number): Promise<LogEntry[]> {
  const from = Math.max(store.getFirstSeq(), seq - window);
  const to = Math.min(store.getLastSeq(), seq + window);
  const results: LogEntry[] = [];
  for (let s = from; s <= to; s++) {
    if (s === seq) continue;
    const entry = await store.read(s);
    if (entry) results.push(entry);
  }
  return results;
}

/** Extract structural signature of a term. */
function getTermStructure(term: unknown): string {
  if (typeof term === 'string') return term;
  if (Array.isArray(term)) return term.map(getTermStructure).join(',');
  if (term && typeof term === 'object') {
    const obj = term as Record<string, unknown>;
    if (obj.operator) return `${obj.operator}(${Object.values(obj).map(getTermStructure).join(',')})`;
    return JSON.stringify(term);
  }
  return String(term);
}

/** Mine procedural schemas from derivation patterns. */
export async function mineProceduralSchemas(
  store: LogStore,
  config: Partial<MiningConfig> = {}
): Promise<ProceduralSchema[]> {
  const { minSupport, minConfidence, maxPatternLength } = { ...defaultMiningConfig, ...config };
  const schemas = new Map<string, ProceduralSchema>();

  const derivations = await query(store, {
    filter: { field: 'event.type', op: { eq: 'derivation.accepted' } },
    limit: 10000,
    orderBy: [{ field: 'seq', direction: 'asc' }],
  });

  // Group by rule sequence
  const ruleSequences = new Map<string, LogEntry[]>();
  for (const entry of derivations.results) {
    if (isDerivationAcceptedEvent(entry.event)) {
      const ruleSeq = entry.event.payload.ruleId ?? 'unknown';
      if (!ruleSequences.has(ruleSeq)) ruleSequences.set(ruleSeq, []);
      ruleSequences.get(ruleSeq)!.push(entry);
    }
  }

  // Build schemas from frequent rule sequences
  for (const [ruleSeq, entries] of ruleSequences) {
    if (entries.length < minSupport) continue;

    // Extract premise/conclusion pattern
    const firstEntry = entries[0];
    if (!firstEntry || !isDerivationAcceptedEvent(firstEntry.event)) continue;
    const premises = firstEntry.event.payload.premises;
    const conclusion = firstEntry.event.payload.conclusion;
    const premiseTemplates = premises.map((p, i) => createTemplate(p, entries.map(e => {
      if (isDerivationAcceptedEvent(e.event)) return e.event.payload.premises[i];
      return null;
    }).filter(Boolean)));
    const conclusionTemplate = createTemplate(conclusion, entries.map(e => {
      if (isDerivationAcceptedEvent(e.event)) return e.event.payload.conclusion;
      return null;
    }).filter(Boolean));

    // Compute confidence (success rate - all accepted derivations are "successful" by definition)
    // In a more sophisticated version, we'd track failed attempts too
    const confidence = 1.0;

    if (confidence >= minConfidence) {
      const id = `schema-${createHash('sha256').update(ruleSeq).digest('hex').substring(0, 8)}`;
      const firstEntry = entries[0];
      const lastEntry = entries[entries.length - 1];
      if (firstEntry && lastEntry) {
        schemas.set(id, {
          id,
          premises: premiseTemplates,
          conclusion: conclusionTemplate,
          ruleSequence: ruleSeq.split(','),
          support: entries.length,
          confidence,
          firstSeen: firstEntry.seq,
          lastSeen: lastEntry.seq,
        });
      }
    }
  }

  return Array.from(schemas.values());
}

/** Create a template from multiple term instances. */
function createTemplate(example: unknown, instances: unknown[]): TermTemplate {
  const template = generalizeTerm(example, instances);
  const bindings = new Map<string, string[]>();

  // Extract variable bindings
  extractBindings(template, bindings);

  return { template, bindings };
}

/** Generalize a term by replacing variable parts with placeholders. */
function generalizeTerm(example: unknown, instances: unknown[]): string {
  const exampleStr = JSON.stringify(example);
  if (instances.length <= 1) return exampleStr;

  // Simple generalization: find common structure
  const instanceStrs = instances.map(v => JSON.stringify(v));
  if (instanceStrs.length === 0) return exampleStr;
  let common: string = instanceStrs[0]!;
  for (let i = 1; i < instanceStrs.length; i++) {
    common = commonPrefix(common, instanceStrs[i]!);
  }

  // Replace varying parts with $VAR
  const replacer = (match: string, offset: number): string => {
    const before = common.substring(0, offset);
    const varName = `VAR${before.split('$VAR').length}`;
    return `$${varName}`;
  };
  return common.replace(/"[^"]*"/g, replacer);
}

/** Find common prefix of two strings. */
function commonPrefix(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return a.substring(0, i);
}

/** Extract variable bindings from a template. */
function extractBindings(template: string, bindings: Map<string, string[]>): void {
  const varRegex = /\$VAR(\d+)/g;
  let match;
  while ((match = varRegex.exec(template)) !== null) {
    const varName = match[0];
    if (!bindings.has(varName)) bindings.set(varName, []);
  }
}

/** Mine term co-occurrence graph. */
export interface CooccurrenceEdge {
  termA: string;
  termB: string;
  count: number;
  pmi: number; // Pointwise mutual information
}

export async function mineTermCooccurrence(
  store: LogStore,
  minCount: number = 5
): Promise<CooccurrenceEdge[]> {
  const termCounts = new Map<string, number>();
  const pairCounts = new Map<string, number>();
  let totalDerivations = 0;

  const derivations = await query(store, {
    filter: { field: 'event.type', op: { eq: 'derivation.accepted' } },
    limit: 50000,
  });

  for (const entry of derivations.results) {
    if (!isDerivationAcceptedEvent(entry.event)) continue;
    totalDerivations++;
    const terms = [
      ...entry.event.payload.premises.map(getTermStructure),
      getTermStructure(entry.event.payload.conclusion),
    ];

    for (const term of terms) {
      termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
    }

    for (let i = 0; i < terms.length; i++) {
      for (let j = i + 1; j < terms.length; j++) {
        const key = [terms[i], terms[j]].sort().join('|');
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const edges: CooccurrenceEdge[] = [];
  for (const [pair, count] of pairCounts) {
    if (count < minCount) continue;
    const parts = pair.split('|');
    if (parts.length !== 2) continue;
    const [termA, termB] = parts;
    const countA = termCounts.get(termA) ?? 0;
    const countB = termCounts.get(termB) ?? 0;
    const pmi = Math.log2((count * totalDerivations) / (countA * countB));
    edges.push({ termA, termB, count, pmi });
  }

  return edges.sort((a, b) => b.pmi - a.pmi);
}

/** Mine causal chains (A -> B -> C patterns). */
export interface CausalChain {
  chain: string[];
  support: number;
  confidence: number;
}

export async function mineCausalChains(
  store: LogStore,
  maxLength: number = 4,
  minSupport: number = 3
): Promise<CausalChain[]> {
  const chains = new Map<string, { count: number; successes: number }>();

  const derivations = await query(store, {
    filter: { field: 'event.type', op: { eq: 'derivation.accepted' } },
    limit: 20000,
    orderBy: [{ field: 'seq', direction: 'asc' }],
  });

  // Build derivation graph
  const termToDerivations = new Map<string, LogEntry[]>();
  for (const entry of derivations.results) {
    if (!isDerivationAcceptedEvent(entry.event)) continue;
    for (const premise of entry.event.payload.premises) {
      const key = getTermStructure(premise);
      if (!termToDerivations.has(key)) termToDerivations.set(key, []);
      termToDerivations.get(key)!.push(entry);
    }
    const conclusionKey = getTermStructure(entry.event.payload.conclusion);
    if (!termToDerivations.has(conclusionKey)) termToDerivations.set(conclusionKey, []);
    termToDerivations.get(conclusionKey)!.push(entry);
  }

  // Find chains (simplified: sequence of derivations where conclusion of one is premise of next)
  for (const entry of derivations.results) {
    if (!isDerivationAcceptedEvent(entry.event)) continue;
    const chain = [getTermStructure(entry.event.payload.conclusion)];
    let current = entry.event.payload.conclusion;
    let currentSeq = entry.seq;

    for (let len = 1; len < maxLength; len++) {
      const nextDerivations = termToDerivations.get(getTermStructure(current)) ?? [];
      const next = nextDerivations.find(d => {
        if (!isDerivationAcceptedEvent(d.event)) return false;
        return d.seq > currentSeq;
      });
      if (!next || !isDerivationAcceptedEvent(next.event)) break;
      chain.push(getTermStructure(next.event.payload.conclusion));
      current = next.event.payload.conclusion;
      currentSeq = next.seq;
    }

    if (chain.length >= 2) {
      const key = chain.join('->');
      const existing = chains.get(key) ?? { count: 0, successes: 0 };
      existing.count++;
      existing.successes++; // All accepted derivations are successes
      chains.set(key, existing);
    }
  }

  const results: CausalChain[] = [];
  for (const [chainStr, { count, successes }] of chains) {
    if (count >= minSupport) {
      results.push({
        chain: chainStr.split('->'),
        support: count,
        confidence: successes / count,
      });
    }
  }

  return results.sort((a, b) => b.confidence * b.support - a.confidence * a.support);
}