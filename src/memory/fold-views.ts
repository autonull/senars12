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

export interface EpisodeCandidate {
  id: string;
  priority: number;
  episode: Episode;
}

export interface ConsolidationResult {
  summary: Episode;
  merged: string[];
  scanned: number;
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

/** Registry of all fold views. */
export interface FoldViewRegistry {
  causalIndex: CausalIndexView;
  conceptGraph: ConceptGraphView;
  associativeMemory: AssociativeMemoryView;
  embeddingLayer: EmbeddingLayerView;
  episodeConsolidator: EpisodeConsolidatorView;
}

/** Create a complete fold view registry. */
export function createFoldViewRegistry(
  getLog: () => Episode[],
  embeddingGenerator: any
): FoldViewRegistry {
  return {
    causalIndex: createCausalIndexView(getLog),
    conceptGraph: createConceptGraphView(getLog),
    associativeMemory: createAssociativeMemoryView(getLog),
    embeddingLayer: createEmbeddingLayerView(getLog, embeddingGenerator),
    episodeConsolidator: createEpisodeConsolidatorView(getLog),
  };
}

/** Refresh all views. */
export async function refreshAllViews(registry: FoldViewRegistry): Promise<void> {
  await Promise.all([
    registry.causalIndex.refresh(),
    registry.conceptGraph.refresh(),
    registry.associativeMemory.refresh(),
    registry.embeddingLayer.refresh(),
    registry.episodeConsolidator.refresh(),
  ]);
}

/** Evict all views (forgetting). */
export function evictAllViews(registry: FoldViewRegistry): void {
  registry.causalIndex.evict();
  registry.conceptGraph.evict();
  registry.associativeMemory.evict();
  registry.embeddingLayer.evict();
  registry.episodeConsolidator.evict();
}