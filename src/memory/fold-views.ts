/**
 * Fold-Derived Memory Views — materialized views of memory indexes derived from the event log.
 *
 * These replace the private stores of CausalIndex, ConceptGraph, Associative/EmbeddingLayer,
 * and EpisodeConsolidator with fold views that preserve every query surface.
 * Forgetting/archive → view eviction.
 */

import type { Term } from '../terms/index';
import { atom, getArgs, termKey, fromNarsese } from '../terms/index';
import { cosineNormalized, normalize } from '../util/similarity';
import type { Episode } from '@senars/types/episodic-memory';
import type { EpisodeCandidate, ConsolidationResult } from './episode-consolidator';
import type { CoActivationEdge } from './ConceptGraph';
import type { RecallHit } from './associative';
import type { IndexedEmbedding } from './links/EmbeddingLayer';

/** Parse context strings to Terms, skipping invalid ones. */
function parseContext(context: string[]): Term[] {
  const terms: Term[] = [];
  for (const s of context) {
    const term = fromNarsese(s);
    if (term) terms.push(term);
  }
  return terms;
}

/** Base fold view interface. */
export interface FoldView<T> {
  /** View name. */
  name: string;
  /** Current version. */
  version: number;
  /** Last updated timestamp. */
  lastUpdated: number;
  /** Whether view is stale (needs refresh). */
  stale: boolean;
  /** Refresh the view from the log. */
  refresh(): Promise<void>;
  /** Evict the view (forgetting). */
  evict(): void;
  /** Get the view data. */
  getData(): T;
}

/** Causal index fold view. */
export interface CausalIndexView extends FoldView<CausalIndexData> {
  causedBy(id: string): Episode[];
  leadingTo(id: string): Episode[];
}

export interface CausalIndexData {
  byCauses: Map<string, Episode[]>;
  byConsequences: Map<string, Episode[]>;
}

/** Create a causal index fold view. */
export function createCausalIndexView(
  getLog: () => Episode[]
): CausalIndexView {
  let data: CausalIndexData = { byCauses: new Map(), byConsequences: new Map() };
  let version = 0;
  let lastUpdated = 0;
  let stale = true;

  const rebuild = (): void => {
    const log = getLog();
    data.byCauses.clear();
    data.byConsequences.clear();

    for (const episode of log) {
      for (const cause of episode.causes ?? []) {
        const arr = data.byCauses.get(cause) ?? [];
        arr.push(episode);
        data.byCauses.set(cause, arr);
      }
      for (const consequence of episode.consequences ?? []) {
        const arr = data.byConsequences.get(consequence) ?? [];
        arr.push(episode);
        data.byConsequences.set(consequence, arr);
      }
    }
    version++;
    lastUpdated = Date.now();
    stale = false;
  };

  return {
    name: 'CausalIndex',
    get version() { return version; },
    get lastUpdated() { return lastUpdated; },
    get stale() { return stale; },
    async refresh() { rebuild(); },
    evict() {
      data.byCauses.clear();
      data.byConsequences.clear();
      stale = true;
    },
    getData() { return data; },
    causedBy(id: string) { return data.byCauses.get(id) ?? []; },
    leadingTo(id: string) { return data.byConsequences.get(id) ?? []; },
  };
}

/** Concept graph fold view. */
export interface ConceptGraphView extends FoldView<ConceptGraphData> {
  activate(term: Term, coActiveWith?: Term): void;
  getCoActivations(term: Term, limit?: number): CoActivationEdge[];
  getActivationCount(term: Term): number;
  decayAll(rate: number): void;
}

export interface ConceptGraphData {
  root: ConceptNodeView;
  nodeCount: number;
  edgeCount: number;
}

export interface ConceptNodeView {
  term: Term;
  children: Map<string, ConceptNodeView>;
  coActivations: Map<string, CoActivationEdge>;
  activationCount: number;
  lastActivated: number;
}

/** Create a concept graph fold view. */
export function createConceptGraphView(
  getLog: () => Episode[],
  options: { maxNodes?: number; maxEdgesPerNode?: number; decayRate?: number; minEdgeWeight?: number } = {}
): ConceptGraphView {
  const { maxNodes = 10000, maxEdgesPerNode = 50, decayRate = 0.001, minEdgeWeight = 0.01 } = options;
  let data: ConceptGraphData = {
    root: { term: atom('ROOT'), children: new Map(), coActivations: new Map(), activationCount: 0, lastActivated: 0 },
    nodeCount: 1,
    edgeCount: 0,
  };
  let version = 0;
  let lastUpdated = 0;
  let stale = true;

  const rebuild = (): void => {
    const log = getLog();

    data.root = { term: atom('ROOT'), children: new Map(), coActivations: new Map(), activationCount: 0, lastActivated: 0 };
    data.nodeCount = 1;
    data.edgeCount = 0;

    for (const episode of log) {
      // Extract terms from episode context (parse strings to Terms)
      const terms = parseContext(episode.context ?? []);
      for (let i = 0; i < terms.length; i++) {
        const term = terms[i]!;
        let node = data.root;
        const args = getArgs(term);

        for (const arg of args) {
          const key = termKey(arg);
          let child = node.children.get(key);
          if (!child) {
            if (data.nodeCount >= maxNodes) break;
            child = { term: arg, children: new Map(), coActivations: new Map(), activationCount: 0, lastActivated: 0 };
            node.children.set(key, child);
            data.nodeCount++;
          }
          node = child;
        }

        node.activationCount++;
        node.lastActivated = episode.timestamp;

        // Co-activation with next term
        if (i + 1 < terms.length) {
          const coActive = terms[i + 1]!;
          const coActiveKey = termKey(coActive);
          let edge = node.coActivations.get(coActiveKey);
          if (!edge) {
            edge = { targetTerm: coActive, weight: 1, evidenceCount: 1, lastUpdated: episode.timestamp };
            node.coActivations.set(coActiveKey, edge);
            data.edgeCount++;
          } else {
            edge.weight++;
            edge.evidenceCount++;
            edge.lastUpdated = episode.timestamp;
          }
        }
      }
    }
    version++;
    lastUpdated = Date.now();
    stale = false;
  };

  return {
    name: 'ConceptGraph',
    get version() { return version; },
    get lastUpdated() { return lastUpdated; },
    get stale() { return stale; },
    async refresh() { await rebuild(); },
    evict() {
      data.root.children.clear();
      data.root.coActivations.clear();
      data.nodeCount = 1;
      data.edgeCount = 0;
      stale = true;
    },
    getData() { return data; },
    activate(term: Term, coActiveWith?: Term) {
      let node = data.root;
      const args = getArgs(term);

      for (const arg of args) {
        const key = termKey(arg);
        let child = node.children.get(key);
        if (!child) {
          if (data.nodeCount >= maxNodes) return;
          child = { term: arg, children: new Map(), coActivations: new Map(), activationCount: 0, lastActivated: 0 };
          node.children.set(key, child);
          data.nodeCount++;
        }
        node = child;
      }

      node.activationCount++;
      node.lastActivated = Date.now();

      if (coActiveWith) {
        const coActiveKey = termKey(coActiveWith);
        let edge = node.coActivations.get(coActiveKey);
        if (!edge) {
          edge = { targetTerm: coActiveWith, weight: 1, evidenceCount: 1, lastUpdated: Date.now() };
          node.coActivations.set(coActiveKey, edge);
          data.edgeCount++;
        } else {
          edge.weight++;
          edge.evidenceCount++;
          edge.lastUpdated = Date.now();
        }
      }
    },
    getCoActivations(term: Term, limit = 10) {
      let node: ConceptNodeView | undefined = data.root;
      const args = getArgs(term);

      for (const arg of args) {
        const key = termKey(arg);
        node = node.children.get(key);
        if (!node) return [];
      }

      const edges = [...node!.coActivations.values()]
        .filter(e => e.weight >= minEdgeWeight)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, limit);

      return edges;
    },
    getActivationCount(term: Term) {
      let node: ConceptNodeView | undefined = data.root;
      const args = getArgs(term);

      for (const arg of args) {
        const key = termKey(arg);
        node = node.children.get(key);
        if (!node) return 0;
      }
      return node!.activationCount;
    },
    decayAll(rate: number) {
      const decay = (node: ConceptNodeView) => {
        node.activationCount *= (1 - rate);
        for (const child of node.children.values()) {
          decay(child);
        }
      };
      decay(data.root);
    },
  };
}

/** Associative memory fold view. */
export interface AssociativeMemoryView extends FoldView<AssociativeMemoryData> {
  recall(term: Term, options?: { limit?: number; minStrength?: number }): RecallHit[];
  associate(from: Term, to: Term, options?: { strength?: number }): boolean;
}

export interface AssociativeMemoryData {
  links: Map<string, Map<string, { target: Term; strength: number; type?: string }>>;
}

/** Create an associative memory fold view. */
export function createAssociativeMemoryView(
  getLog: () => Episode[]
): AssociativeMemoryView {
  let data: AssociativeMemoryData = { links: new Map() };
  let version = 0;
  let lastUpdated = 0;
  let stale = true;

  const rebuild = (): void => {
    const log = getLog();
    data.links.clear();

    for (const episode of log) {
      const terms = parseContext(episode.context ?? []);
      for (let i = 0; i < terms.length - 1; i++) {
        const from = terms[i]!;
        const to = terms[i + 1]!;
        const fromKey = termKey(from);
        const toKey = termKey(to);

        if (!fromKey || !toKey) continue;

        const fromLinks = data.links.get(fromKey) ?? new Map();
        fromLinks.set(toKey, { target: to, strength: 1.0, type: 'temporal' });
        data.links.set(fromKey, fromLinks);
      }
    }
    version++;
    lastUpdated = Date.now();
    stale = false;
  };

  return {
    name: 'AssociativeMemory',
    get version() { return version; },
    get lastUpdated() { return lastUpdated; },
    get stale() { return stale; },
    async refresh() { rebuild(); },
    evict() {
      data.links.clear();
      stale = true;
    },
    getData() { return data; },
    recall(term: Term, { limit = 10, minStrength = 0 } = {}) {
      const key = termKey(term);
      if (!key) return [];

      const links = data.links.get(key);
      if (!links) return [];

      return [...links.values()]
        .filter(l => l.strength >= minStrength)
        .sort((a, b) => b.strength - a.strength)
        .slice(0, limit)
        .map(l => ({ term: l.target, strength: l.strength }));
    },
    associate(from: Term, to: Term, { strength = 1.0 } = {}) {
      const fromKey = termKey(from);
      const toKey = termKey(to);
      if (!fromKey || !toKey) return false;

      const fromLinks = data.links.get(fromKey) ?? new Map();
      fromLinks.set(toKey, { target: to, strength, type: 'associative' });
      data.links.set(fromKey, fromLinks);
      return true;
    },
  };
}

/** Embedding layer fold view. */
export interface EmbeddingLayerView extends FoldView<EmbeddingLayerData> {
  indexConcept(term: Term): Promise<void>;
  findSimilarTerms(queryTerm: Term, topK?: number): Promise<Array<{ term: Term; similarity: number }>>;
  similarity(termA: Term, termB: Term): number;
}

export interface EmbeddingLayerData {
  embeddings: Map<string, IndexedEmbedding>;
  generator: any; // EmbeddingGenerator
}

/** Create an embedding layer fold view. */
export function createEmbeddingLayerView(
  getLog: () => Episode[],
  generator: any // EmbeddingGenerator
): EmbeddingLayerView {
  let data: EmbeddingLayerData = { embeddings: new Map(), generator };
  let version = 0;
  let lastUpdated = 0;
  let stale = true;

  const rebuild = async (): Promise<void> => {
    const log = getLog();
    data.embeddings.clear();

    // Index all unique terms from log
    const uniqueTerms = new Map<string, Term>();
    for (const episode of log) {
      const terms = parseContext(episode.context ?? []);
      for (const term of terms) {
        const key = termKey(term);
        if (key && !uniqueTerms.has(key)) {
          uniqueTerms.set(key, term);
        }
      }
    }

    // Generate embeddings in batches
    for (const term of uniqueTerms.values()) {
      await indexConceptInternal(term);
    }

    version++;
    lastUpdated = Date.now();
    stale = false;
  };

  const indexConceptInternal = async (term: Term): Promise<void> => {
    const key = termKey(term);
    if (!key) return;

    const embedding = await data.generator.generate(term.toString());
    data.embeddings.set(key, { term, embedding });
  };

  return {
    name: 'EmbeddingLayer',
    get version() { return version; },
    get lastUpdated() { return lastUpdated; },
    get stale() { return stale; },
    async refresh() { await rebuild(); },
    evict() {
      data.embeddings.clear();
      stale = true;
    },
    getData() { return data; },
    async indexConcept(term: Term) {
      await indexConceptInternal(term);
      version++;
      lastUpdated = Date.now();
    },
    async findSimilarTerms(queryTerm: Term, topK = 10) {
      const queryEmbedding = await data.generator.generate(queryTerm.toString());
      const query = normalize(queryEmbedding);
      const results: Array<{ term: Term; similarity: number }> = [];
      const queryKey = termKey(queryTerm);

      for (const [key, indexed] of data.embeddings) {
        if (key === queryKey) continue;
        const similarity = cosineNormalized(query, indexed.embedding);
        results.push({ term: indexed.term, similarity });
      }

      return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
    },
    similarity(termA: Term, termB: Term) {
      const keyA = termKey(termA);
      const keyB = termKey(termB);
      if (!keyA || !keyB) return 0;

      const embA = data.embeddings.get(keyA)?.embedding;
      const embB = data.embeddings.get(keyB)?.embedding;
      if (!embA || !embB) return 0;

      return cosineNormalized(normalize(embA), embB);
    },
  };
}

/** Episode consolidator fold view. */
export interface EpisodeConsolidatorView extends FoldView<EpisodeConsolidatorData> {
  consolidate(budget?: number): Promise<ConsolidationResult[]>;
  getCandidates(): EpisodeCandidate[];
}

export interface EpisodeConsolidatorData {
  candidates: EpisodeCandidate[];
  emittedSummaries: Episode[];
}



/** Create an episode consolidator fold view. */
export function createEpisodeConsolidatorView(
  getLog: () => Episode[]
): EpisodeConsolidatorView {
  let data: EpisodeConsolidatorData = { candidates: [], emittedSummaries: [] };
  let version = 0;
  let lastUpdated = 0;
  let stale = true;

  const rebuild = (): void => {
    const log = getLog();
    data.candidates = log
      .filter(e => !data.emittedSummaries.some(s => s.id === e.id)) // Skip already consolidated
      .map(e => ({ id: e.id ?? `ep-${e.timestamp}-${Math.random().toString(36).slice(2)}`, priority: calculateEpisodePriority(e), episode: e }))
      .sort((a, b) => b.priority - a.priority);
    version++;
    lastUpdated = Date.now();
    stale = false;
  };

  return {
    name: 'EpisodeConsolidator',
    get version() { return version; },
    get lastUpdated() { return lastUpdated; },
    get stale() { return stale; },
    async refresh() { rebuild(); },
    evict() {
      data.candidates = [];
      data.emittedSummaries = [];
      stale = true;
    },
    getData() { return data; },
    getCandidates() { return data.candidates; },
    async consolidate(budget = 8) {
      const candidates = data.candidates.slice(0, budget);
      const results: ConsolidationResult[] = [];

      // Group by type and context similarity
      const groups = new Map<string, EpisodeCandidate[]>();
      for (const c of candidates) {
        const key = `${c.episode.type}:${JSON.stringify(c.episode.context?.slice(0, 3))}`;
        const g = groups.get(key) ?? [];
        g.push(c);
        groups.set(key, g);
      }

      for (const [, group] of groups) {
        if (group.length < 2) continue; // Only consolidate groups

        const summary = mergeEpisodes(group.map(g => g.episode));
        results.push({
          summary,
          merged: group.map(g => g.id),
          scanned: group.length,
        });

        data.emittedSummaries.push(summary);
        // Remove merged from candidates
        for (const g of group) {
          const idx = data.candidates.findIndex(c => c.id === g.id);
          if (idx >= 0) data.candidates.splice(idx, 1);
        }
      }

      version++;
      lastUpdated = Date.now();
      return results;
    },
  };
}

function calculateEpisodePriority(episode: Episode): number {
  const SALIENCE: Record<string, number> = {
    reaction: 1.0,
    error: 0.9,
    dialogue: 0.8,
    question: 0.6,
    belief_added: 0.5,
    input: 0.5,
    response: 0.5,
    tool_call: 0.4,
  };

  const salience = SALIENCE[episode.type] ?? 0.5;
  const causal = (episode.causes?.length ?? 0) + (episode.consequences?.length ?? 0) + (episode.context?.length ?? 0);
  const intrinsic = salience * (1 + causal);

  const ageHours = (Date.now() - episode.timestamp) / 3_600_000;
  const recency = 1 / (1 + ageHours / 168); // softFalloff approximation

  return intrinsic * recency;
}

function mergeEpisodes(episodes: Episode[]): Episode {
  const first = episodes[0]!;
  return {
    id: `summary-${first.id}-${Date.now()}`,
    type: 'belief_added',
    content: `Summary of ${episodes.length} episodes`,
    timestamp: Date.now(),
    context: episodes.flatMap(e => e.context ?? []).slice(0, 20),
    causes: episodes.flatMap(e => e.causes ?? []),
    consequences: episodes.flatMap(e => e.consequences ?? []),
    metadata: { kind: 'summary', mergedCount: episodes.length },
  };
}

/** Analyzer fold view base interface. */
export interface AnalyzerFoldView<T> extends FoldView<T> {
  /** Get analysis for a specific episode. */
  analyzeEpisode(episode: Episode): T;
  /** Get aggregated analysis across all episodes. */
  getAggregated(): T;
}

/** Factory for creating analyzer fold views with shared boilerplate. */
function createAnalyzer<T>(
  name: string,
  initialData: T,
  rebuild: (data: T, log: Episode[]) => void,
  emptyData: T,
  getLog: () => Episode[]
): AnalyzerFoldView<T> {
  let data = initialData;
  let version = 0;
  let lastUpdated = 0;
  let stale = true;

  const doRebuild = (): void => {
    rebuild(data, getLog());
    version++;
    lastUpdated = Date.now();
    stale = false;
  };

  return {
    name,
    get version() { return version; },
    get lastUpdated() { return lastUpdated; },
    get stale() { return stale; },
    async refresh() { doRebuild(); },
    evict() { data = initialData; stale = true; },
    getData() { return data; },
    analyzeEpisode() { return emptyData; },
    getAggregated() { return data; },
  };
}

/** Analyzer definition for data-driven registration. */
interface AnalyzerDef<T> {
  name: string;
  initialData: T;
  emptyData: T;
  rebuild: (data: T, log: Episode[]) => void;
}

/** All analyzer definitions — single source of truth for analyzer views. */
const ANALYZER_DEFS = [
  {
    name: 'CapabilitiesAnalyzer',
    initialData: { capabilityUsage: new Map<string, number>(), coverage: 0 } as { capabilityUsage: Map<string, number>; coverage: number },
    emptyData: { capabilityUsage: new Map<string, number>(), coverage: 0 },
    rebuild: (data: { capabilityUsage: Map<string, number>; coverage: number }, log: Episode[]) => {
      data.capabilityUsage.clear();
      let totalCapabilities = 0;
      for (const episode of log) {
        const caps = episode.metadata?.capabilities as string[] ?? [];
        for (const cap of caps) {
          data.capabilityUsage.set(cap, (data.capabilityUsage.get(cap) ?? 0) + 1);
        }
        totalCapabilities += caps.length;
      }
      data.coverage = totalCapabilities > 0 ? totalCapabilities / log.length : 0;
    },
  },
  {
    name: 'ConstantsAnalyzer',
    initialData: { constantValues: new Map<string, { value: unknown; count: number }>() },
    emptyData: { constantValues: new Map<string, { value: unknown; count: number }>() },
    rebuild: (data: { constantValues: Map<string, { value: unknown; count: number }> }, log: Episode[]) => {
      data.constantValues.clear();
      for (const episode of log) {
        const constants = episode.metadata?.constants as Record<string, unknown> ?? {};
        for (const [key, value] of Object.entries(constants)) {
          const entry = data.constantValues.get(key) ?? { value, count: 0 };
          entry.count++;
          data.constantValues.set(key, entry);
        }
      }
    },
  },
  {
    name: 'CorrectionsAnalyzer',
    initialData: { corrections: [] as Array<{ from: string; to: string; confidence: number }> },
    emptyData: { corrections: [] as Array<{ from: string; to: string; confidence: number }> },
    rebuild: (data: { corrections: Array<{ from: string; to: string; confidence: number }> }, log: Episode[]) => {
      data.corrections = [];
      for (const episode of log) {
        const correction = episode.metadata?.correction as { from: string; to: string; confidence: number } | undefined;
        if (correction) data.corrections.push(correction);
      }
    },
  },
  {
    name: 'PerformanceAnalyzer',
    initialData: { metrics: new Map<string, { mean: number; count: number }>() },
    emptyData: { metrics: new Map<string, { mean: number; count: number }>() },
    rebuild: (data: { metrics: Map<string, { mean: number; count: number }> }, log: Episode[]) => {
      data.metrics.clear();
      for (const episode of log) {
        const metrics = episode.metadata as Record<string, number> ?? {};
        for (const [key, value] of Object.entries(metrics)) {
          const entry = data.metrics.get(key) ?? { mean: 0, count: 0 };
          entry.mean = (entry.mean * entry.count + value) / (entry.count + 1);
          entry.count++;
          data.metrics.set(key, entry);
        }
      }
    },
  },
  {
    name: 'QualityAnalyzer',
    initialData: { qualityScores: [] as number[], meanQuality: 0 },
    emptyData: { qualityScores: [] as number[], meanQuality: 0 },
    rebuild: (data: { qualityScores: number[]; meanQuality: number }, log: Episode[]) => {
      data.qualityScores = log.map(e => (e.metadata?.quality as number) ?? 0).filter(q => q > 0);
      data.meanQuality = data.qualityScores.length > 0 ? data.qualityScores.reduce((a, b) => a + b, 0) / data.qualityScores.length : 0;
    },
  },
  {
    name: 'ReasoningPatternsAnalyzer',
    initialData: { patterns: new Map<string, number>() },
    emptyData: { patterns: new Map<string, number>() },
    rebuild: (data: { patterns: Map<string, number> }, log: Episode[]) => {
      data.patterns.clear();
      for (const episode of log) {
        const pattern = episode.metadata?.reasoningPattern as string | undefined;
        if (pattern) data.patterns.set(pattern, (data.patterns.get(pattern) ?? 0) + 1);
      }
    },
  },
  {
    name: 'ResourcesAnalyzer',
    initialData: { resourceUsage: new Map<string, { mean: number; peak: number; count: number }>() },
    emptyData: { resourceUsage: new Map<string, { mean: number; peak: number; count: number }>() },
    rebuild: (data: { resourceUsage: Map<string, { mean: number; peak: number; count: number }> }, log: Episode[]) => {
      data.resourceUsage.clear();
      for (const episode of log) {
        const resources = episode.metadata?.resources as Record<string, number> ?? {};
        for (const [key, value] of Object.entries(resources)) {
          const entry = data.resourceUsage.get(key) ?? { mean: 0, peak: 0, count: 0 };
          entry.mean = (entry.mean * entry.count + value) / (entry.count + 1);
          entry.peak = Math.max(entry.peak, value);
          entry.count++;
          data.resourceUsage.set(key, entry);
        }
      }
    },
  },
  {
    name: 'TermPatternsAnalyzer',
    initialData: { termFrequency: new Map<string, number>(), coOccurrence: new Map<string, Map<string, number>>() },
    emptyData: { termFrequency: new Map<string, number>(), coOccurrence: new Map<string, Map<string, number>>() },
    rebuild: (data: { termFrequency: Map<string, number>; coOccurrence: Map<string, Map<string, number>> }, log: Episode[]) => {
      data.termFrequency.clear();
      data.coOccurrence.clear();
      for (const episode of log) {
        const terms = episode.context?.map(t => t.toString()) ?? [];
        for (const term of terms) {
          data.termFrequency.set(term, (data.termFrequency.get(term) ?? 0) + 1);
        }
        for (let i = 0; i < terms.length - 1; i++) {
          const co = data.coOccurrence.get(terms[i]!) ?? new Map();
          co.set(terms[i + 1]!, (co.get(terms[i + 1]!) ?? 0) + 1);
          data.coOccurrence.set(terms[i]!, co);
        }
      }
    },
  },
] as const satisfies readonly AnalyzerDef<any>[];

/** Generated analyzer view creators — one per definition. */
export interface CapabilitiesAnalyzerData { capabilityUsage: Map<string, number>; coverage: number; }
export const createCapabilitiesAnalyzerView = (getLog: () => Episode[]) =>
  createAnalyzer(ANALYZER_DEFS[0].name, ANALYZER_DEFS[0].initialData, ANALYZER_DEFS[0].rebuild, ANALYZER_DEFS[0].emptyData, getLog);

export interface ConstantsAnalyzerData { constantValues: Map<string, { value: unknown; count: number }>; }
export const createConstantsAnalyzerView = (getLog: () => Episode[]) =>
  createAnalyzer(ANALYZER_DEFS[1].name, ANALYZER_DEFS[1].initialData, ANALYZER_DEFS[1].rebuild, ANALYZER_DEFS[1].emptyData, getLog);

export interface CorrectionsAnalyzerData { corrections: Array<{ from: string; to: string; confidence: number }>; }
export const createCorrectionsAnalyzerView = (getLog: () => Episode[]) =>
  createAnalyzer(ANALYZER_DEFS[2].name, ANALYZER_DEFS[2].initialData, ANALYZER_DEFS[2].rebuild, ANALYZER_DEFS[2].emptyData, getLog);

export interface PerformanceAnalyzerData { metrics: Map<string, { mean: number; count: number }>; }
export const createPerformanceAnalyzerView = (getLog: () => Episode[]) =>
  createAnalyzer(ANALYZER_DEFS[3].name, ANALYZER_DEFS[3].initialData, ANALYZER_DEFS[3].rebuild, ANALYZER_DEFS[3].emptyData, getLog);

export interface QualityAnalyzerData { qualityScores: number[]; meanQuality: number; }
export const createQualityAnalyzerView = (getLog: () => Episode[]) =>
  createAnalyzer(ANALYZER_DEFS[4].name, ANALYZER_DEFS[4].initialData, ANALYZER_DEFS[4].rebuild, ANALYZER_DEFS[4].emptyData, getLog);

export interface ReasoningPatternsAnalyzerData { patterns: Map<string, number>; }
export const createReasoningPatternsAnalyzerView = (getLog: () => Episode[]) =>
  createAnalyzer(ANALYZER_DEFS[5].name, ANALYZER_DEFS[5].initialData, ANALYZER_DEFS[5].rebuild, ANALYZER_DEFS[5].emptyData, getLog);

export interface ResourcesAnalyzerData { resourceUsage: Map<string, { mean: number; peak: number; count: number }>; }
export const createResourcesAnalyzerView = (getLog: () => Episode[]) =>
  createAnalyzer(ANALYZER_DEFS[6].name, ANALYZER_DEFS[6].initialData, ANALYZER_DEFS[6].rebuild, ANALYZER_DEFS[6].emptyData, getLog);

export interface TermPatternsAnalyzerData { termFrequency: Map<string, number>; coOccurrence: Map<string, Map<string, number>>; }
export const createTermPatternsAnalyzerView = (getLog: () => Episode[]) =>
  createAnalyzer(ANALYZER_DEFS[7].name, ANALYZER_DEFS[7].initialData, ANALYZER_DEFS[7].rebuild, ANALYZER_DEFS[7].emptyData, getLog);

/** Registry of all fold views using KeyedRegistry. */
import { KeyedRegistry } from '../util/keyed-collection';
import { SenarsError } from '../errors/senars-error';

/** Registry of all fold views using KeyedRegistry. */
export class FoldViewRegistry {
  readonly views: KeyedRegistry<FoldView<any>>;

  constructor() {
    this.views = new KeyedRegistry<FoldView<any>>({
      keyOf: (v) => v.name,
      onDuplicate: (name) => { throw new SenarsError(`Fold view '${name}' already registered`, 'VALIDATION_ERROR', { name }); },
    });
  }

  /** Register a fold view. */
  register(view: FoldView<any>): void {
    this.views.register(view);
  }

  /** Get a fold view by name. */
  get(name: string): FoldView<any> | undefined {
    return this.views.get(name);
  }

  /** Get all registered view names. */
  getNames(): string[] {
    return this.views.keys();
  }

  /** Get all registered views. */
  getAll(): FoldView<any>[] {
    return this.views.all();
  }

  /** Refresh all views. */
  async refreshAll(): Promise<void> {
    await Promise.all(this.views.all().map((v) => v.refresh()));
  }

  /** Evict all views (forgetting). */
  evictAll(): void {
    for (const view of this.views.all()) {
      view.evict();
    }
  }

  /** Clear all registrations. */
  clear(): void {
    this.views.clear();
  }
}

/** Create a complete fold view registry with all standard views. */
/** Map analyzer name to its creator function. */
const ANALYZER_CREATORS: Record<string, (getLog: () => Episode[]) => AnalyzerFoldView<any>> = {
  CapabilitiesAnalyzer: createCapabilitiesAnalyzerView,
  ConstantsAnalyzer: createConstantsAnalyzerView,
  CorrectionsAnalyzer: createCorrectionsAnalyzerView,
  PerformanceAnalyzer: createPerformanceAnalyzerView,
  QualityAnalyzer: createQualityAnalyzerView,
  ReasoningPatternsAnalyzer: createReasoningPatternsAnalyzerView,
  ResourcesAnalyzer: createResourcesAnalyzerView,
  TermPatternsAnalyzer: createTermPatternsAnalyzerView,
};

export function createFoldViewRegistry(
  getLog: () => Episode[],
  embeddingGenerator: any
): FoldViewRegistry {
  const registry = new FoldViewRegistry();
  
  registry.register(createCausalIndexView(getLog));
  registry.register(createConceptGraphView(getLog));
  registry.register(createAssociativeMemoryView(getLog));
  registry.register(createEmbeddingLayerView(getLog, embeddingGenerator));
  registry.register(createEpisodeConsolidatorView(getLog));
  
  // Register all analyzer views from the single source of truth
  for (const def of ANALYZER_DEFS) {
    const creator = ANALYZER_CREATORS[def.name];
    if (creator) registry.register(creator(getLog));
  }
  
  return registry;
}

/** Refresh all views. */
export async function refreshAllViews(registry: FoldViewRegistry): Promise<void> {
  await registry.refreshAll();
}

/** Evict all views (forgetting). */
export function evictAllViews(registry: FoldViewRegistry): void {
  registry.evictAll();
}