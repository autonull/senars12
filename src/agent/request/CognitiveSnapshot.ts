import type {NAR} from '../../nar/nar.js';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';
import type {CognitiveSnapshotData, Route} from '../types.js';

export interface CognitiveSnapshotDeps {
    nar?: NAR;
    episodicMemory?: EpisodicMemory;
    pinnedBeliefs?: string[];
    summary?: string;
    priorInsights?: string[];
    maxTokens?: number;
    maxAttention?: number;
    maxQuestions?: number;
    maxGoals?: number;
    maxEpisodes?: number;
}

export interface CognitiveSnapshotInput extends CognitiveSnapshotDeps {
    ctxHash: string;
}

export const DEFAULT_SNAPSHOT_BUDGET = 1024;
export const DEFAULT_TTL_MS = 1000;

interface CacheEntry {
    snapshot: CognitiveSnapshotData;
    expiresAt: number;
}

/**
 * Pure read-only view of NARS / memory state captured once per `ctxHash`.
 * Memoized per-hash with a TTL; explicitly invalidated when NAR state
 * changes (see `invalidate(ctxHash)` and `invalidateAll()`).
 */
export class CognitiveSnapshot {
    private readonly maxTokens: number;
    private readonly maxAttention: number;
    private readonly maxQuestions: number;
    private readonly maxGoals: number;
    private readonly maxEpisodes: number;
    private readonly ttlMs: number;
    private readonly cache = new Map<string, CacheEntry>();
    private computeCount = 0;

    constructor(opts: {maxTokens?: number; maxAttention?: number; maxQuestions?: number; maxGoals?: number; maxEpisodes?: number; ttlMs?: number} = {}) {
        this.maxTokens = opts.maxTokens ?? DEFAULT_SNAPSHOT_BUDGET;
        this.maxAttention = opts.maxAttention ?? 15;
        this.maxQuestions = opts.maxQuestions ?? 5;
        this.maxGoals = opts.maxGoals ?? 3;
        this.maxEpisodes = opts.maxEpisodes ?? 5;
        this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    }

    async get(input: CognitiveSnapshotInput): Promise<CognitiveSnapshotData | null> {
        if (!input.nar) return null;
        const cached = this.cache.get(input.ctxHash);
        if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

        const snap = await this.compute(input);
        this.cache.set(input.ctxHash, {snapshot: snap, expiresAt: Date.now() + this.ttlMs});
        this.computeCount++;
        return snap;
    }

    invalidate(ctxHash: string): void {
        this.cache.delete(ctxHash);
    }

    invalidateAll(): void {
        this.cache.clear();
    }

    getComputeCount(): number {
        return this.computeCount;
    }

    size(): number {
        return this.cache.size;
    }

    private async compute(input: CognitiveSnapshotInput): Promise<CognitiveSnapshotData> {
        const nar = input.nar!;
        const attention = nar.attentionReport();
        const beliefs = nar.getBeliefs();
        const stats = nar.getStatistics();
        const attentionEntries = attention.concepts.slice(0, this.maxAttention).map(c => {
            const belief = beliefs.find(b => b.term.toString() === c.term);
            const entry: CognitiveSnapshotData['attention'][number] = {term: c.term, priority: c.priority};
            const cUrgency = (c as {urgency?: number}).urgency;
            if (cUrgency !== undefined) entry.urgency = cUrgency;
            if (belief?.truth) entry.truth = {f: belief.truth.f, c: belief.truth.c};
            return entry;
        });

        const questions = nar.getQuestions().slice(0, this.maxQuestions).map(q => q.term.toString());
        const goals = nar.getGoals().slice(0, this.maxGoals).map(g => g.term.toString());
        const memory = {
            totalConcepts: stats.totalConcepts,
            totalTasks: stats.totalTasks,
            workingMemorySize: nar.workingMemory.size(),
        };

        let episodes: CognitiveSnapshotData['episodes'] = [];
        if (input.episodicMemory) {
            try {
                const recent = await input.episodicMemory.getEpisodes({limit: this.maxEpisodes});
                episodes = recent.map(e => ({
                    timestamp: e.timestamp,
                    type: e.type,
                    summary: typeof e.content === 'string' ? e.content.slice(0, 100) : JSON.stringify(e.content).slice(0, 100),
                }));
            } catch {
                episodes = [];
            }
        }

        const snap: CognitiveSnapshotData = {
            attention: attentionEntries,
            questions,
            goals,
            memory,
            episodes,
            pinnedBeliefs: input.pinnedBeliefs ? [...input.pinnedBeliefs] : [],
            tokens: 0,
            capturedAt: Date.now(),
        };
        if (input.summary !== undefined) snap.summary = input.summary;
        if (input.priorInsights !== undefined) snap.priorInsights = [...input.priorInsights];

        snap.tokens = estimateTokens(snap);
        if (snap.tokens > this.maxTokens) this.trimToBudget(snap);
        return snap;
    }

    private trimToBudget(snap: CognitiveSnapshotData): void {
        const target = this.maxTokens;
        const order: Array<keyof CognitiveSnapshotData> = ['episodes', 'questions', 'goals', 'attention', 'pinnedBeliefs', 'priorInsights'];
        for (const k of order) {
            if (snap.tokens <= target) break;
            const v = snap[k];
            if (Array.isArray(v) && v.length > 0) {
                (snap as unknown as Record<string, unknown>)[k] = v.slice(0, Math.max(0, v.length - 1));
            }
            snap.tokens = estimateTokens(snap);
        }
    }
}

export function estimateTokens(snap: CognitiveSnapshotData): number {
    let chars = 0;
    chars += JSON.stringify(snap.attention).length;
    chars += JSON.stringify(snap.questions).length;
    chars += JSON.stringify(snap.goals).length;
    chars += JSON.stringify(snap.memory).length;
    chars += JSON.stringify(snap.episodes).length;
    chars += (snap.summary?.length ?? 0);
    chars += JSON.stringify(snap.pinnedBeliefs).length;
    chars += JSON.stringify(snap.priorInsights ?? []).length;
    return Math.ceil(chars / 4);
}

export function buildCtxHash(route: Route, nar: {getStatistics(): {totalConcepts?: number; totalTasks?: number}} | undefined, lastInputAt: number): string {
    if (!nar) return `route:${route.kind}:empty:${lastInputAt}`;
    const stats = nar.getStatistics();
    return `route:${route.kind}:c${stats.totalConcepts ?? 0}:t${stats.totalTasks ?? 0}:t${lastInputAt}`;
}
