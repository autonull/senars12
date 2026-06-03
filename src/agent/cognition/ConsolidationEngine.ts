import type {NAR} from '../../nar/nar.js';
import type {LMClient} from '../../nar/lm/types.js';
import type {EpisodicMemory, Episode} from '../../nar/memory/EpisodicMemory.js';
import type {ReasoningArtifact} from '../types.js';

export interface ConsolidationEngineDeps {
    nar?: NAR;
    lmClient?: LMClient;
    episodicMemory?: EpisodicMemory;
    debounceMs?: number;
    maxClusterLmCalls?: number;
    now?: () => number;
}

export interface EpisodeRecord {
    id: string;
    timestamp: number;
    input: string;
    response: string;
    concepts: string[];
    artifacts: ReasoningArtifact[];
    routeKind?: string;
}

interface Cluster {
    term: string;
    episodes: EpisodeRecord[];
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_MAX_CLUSTER_CALLS = 3;
const DEFAULT_LOG_CAPACITY = 256;

const FALLBACK_AGGREGATE_TERMS = (episodes: EpisodeRecord[]): string[] => {
    const bag = new Map<string, number>();
    for (const ep of episodes) {
        for (const c of ep.concepts) bag.set(c, (bag.get(c) ?? 0) + 1);
    }
    return [...bag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);
};

const extractJson = (raw: string): unknown => {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return undefined;
    try {
        return JSON.parse(raw.slice(start, end + 1));
    } catch {
        return undefined;
    }
};

const parseConsolidation = (raw: string): string[] => {
    const obj = extractJson(raw);
    if (!obj || typeof obj !== 'object') return [];
    const arr = (obj as {beliefs?: unknown}).beliefs;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string' && x.length > 0);
};

/**
 * ConsolidationEngine — Phase 8 (invariant I11).
 *
 * Converts episodic memory into durable NARS beliefs. The chat path
 * hands episode records to `schedule(...)`; the engine debounces and
 * runs a single background pass that:
 *
 *  1. groups episodes by concept cluster (term bag);
 *  2. for each cluster, asks the LM to extract durable Narsese beliefs;
 *  3. validates via the LM's own Narsese parse attempt;
 *  4. injects them as new belief tasks.
 *
 * LM calls are bounded (default 3 per pass). Everything is abortable via
 * an `AbortSignal` and runs off the critical path (`setImmediate`).
 */
export class ConsolidationEngine {
    private readonly deps: Required<ConsolidationEngineDeps>;
    private buffer: EpisodeRecord[] = [];
    private log: EpisodeRecord[] = [];
    private logCapacity: number;
    private timer?: NodeJS.Timeout;
    private inFlight = false;
    private passCount = 0;
    private aborted = false;
    private abortController?: AbortController;

    constructor(deps: ConsolidationEngineDeps = {}) {
        this.deps = {
            nar: deps.nar as NAR,
            lmClient: deps.lmClient as LMClient,
            episodicMemory: deps.episodicMemory as EpisodicMemory,
            debounceMs: deps.debounceMs ?? DEFAULT_DEBOUNCE_MS,
            maxClusterLmCalls: deps.maxClusterLmCalls ?? DEFAULT_MAX_CLUSTER_CALLS,
            now: deps.now ?? (() => Date.now()),
        };
        this.logCapacity = DEFAULT_LOG_CAPACITY;
    }

    schedule(record: EpisodeRecord, signal?: AbortSignal): void {
        if (this.aborted) return;
        if (signal?.aborted) return;
        this.buffer.push(record);
        this.appendToLog(record);
        if (this.timer) clearTimeout(this.timer);
        const debounce = this.deps.debounceMs;
        this.timer = setTimeout(() => {
            this.timer = undefined;
            setImmediate(() => { void this.run(); });
        }, debounce);
        if (typeof this.timer.unref === 'function') this.timer.unref();
    }

    private appendToLog(record: EpisodeRecord): void {
        this.log.push(record);
        if (this.log.length > this.logCapacity) {
            this.log.splice(0, this.log.length - this.logCapacity);
        }
    }

    getEpisodeById(id: string): EpisodeRecord | undefined {
        return this.log.find(r => r.id === id);
    }

    getRecentEpisodes(limit = 20): EpisodeRecord[] {
        return this.log.slice(-limit);
    }

    getLogSize(): number {
        return this.log.length;
    }

    getPassCount(): number {
        return this.passCount;
    }

    getBufferSize(): number {
        return this.buffer.length;
    }

    isInFlight(): boolean {
        return this.inFlight;
    }

    abort(): void {
        this.aborted = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        this.abortController?.abort();
    }

    reset(): void {
        this.buffer = [];
        this.log = [];
        this.passCount = 0;
        this.inFlight = false;
        this.aborted = false;
    }

    /**
     * Consume any recent episodes from the episodic memory and feed them
     * to the consolidation pipeline. This is the integration point used
     * by `AIAgent.executeEpisode` to pull durable state from past turns.
     */
    async feedFromMemory(limit = 20, signal?: AbortSignal): Promise<number> {
        if (!this.deps.episodicMemory) return 0;
        const episodes = await this.deps.episodicMemory.getEpisodes({limit});
        let added = 0;
        for (const e of episodes) {
            if (signal?.aborted) break;
            if (e.type !== 'input' && e.type !== 'response') continue;
            const rec: EpisodeRecord = {
                id: `${e.timestamp}-${e.type}`,
                timestamp: e.timestamp,
                input: e.type === 'input' ? e.content : '',
                response: e.type === 'response' ? e.content : '',
                concepts: extractConceptsFromMetadata(e),
                artifacts: [],
            };
            this.schedule(rec, signal);
            added++;
        }
        return added;
    }

    private async run(): Promise<void> {
        if (this.inFlight || this.aborted) return;
        if (this.buffer.length === 0) return;
        this.inFlight = true;
        const controller = new AbortController();
        this.abortController = controller;
        const batch = this.buffer.slice();
        this.buffer = [];
        try {
            const clusters = this.cluster(batch);
            const limited = clusters.slice(0, this.deps.maxClusterLmCalls);
            for (const cluster of limited) {
                if (controller.signal.aborted) break;
                const statements = await this.extractBeliefs(cluster, controller.signal);
                for (const stmt of statements) {
                    if (controller.signal.aborted) break;
                    await this.inject(stmt, cluster.term);
                }
            }
            this.passCount++;
        } catch (_err) {
            // Re-buffer on failure so a retry is possible next pass
            this.buffer = [...batch, ...this.buffer];
        } finally {
            this.inFlight = false;
            if (this.abortController === controller) this.abortController = undefined;
        }
    }

    private cluster(episodes: EpisodeRecord[]): Cluster[] {
        const byTerm = new Map<string, EpisodeRecord[]>();
        for (const ep of episodes) {
            for (const c of ep.concepts) {
                const list = byTerm.get(c) ?? [];
                list.push(ep);
                byTerm.set(c, list);
            }
        }
        return [...byTerm.entries()]
            .filter(([, eps]) => eps.length > 0)
            .map(([term, eps]) => ({term, episodes: eps}));
    }

    private async extractBeliefs(cluster: Cluster, signal: AbortSignal): Promise<string[]> {
        if (!this.deps.lmClient) {
            // Fallback: aggregate the most common terms into a single belief
            const terms = FALLBACK_AGGREGATE_TERMS(cluster.episodes);
            return terms.length > 0 ? [`(${cluster.term}, ${terms.join(', ')}).`] : [];
        }
        const ctx = cluster.episodes.slice(0, 5).map((e, i) =>
            `${i + 1}. user: ${e.input.slice(0, 200)}\n   assistant: ${e.response.slice(0, 200)}`
        ).join('\n');
        const prompt = `You are consolidating recent episodes about "${cluster.term}" into durable Narsese beliefs.\n\nEpisodes:\n${ctx}\n\n` +
            `Respond with JSON: {"beliefs":["(<term> --> <predicate>).", ...]}\n` +
            `Output ONLY the JSON.`;
        try {
            const raw = await this.deps.lmClient.generateText(prompt, {maxTokens: 256, signal});
            return parseConsolidation(raw);
        } catch {
            return [];
        }
    }

    private async inject(statement: string, _sourceTerm: string): Promise<void> {
        if (!this.deps.nar) return;
        try {
            await this.deps.nar.input(statement, 'belief');
        } catch {
            // Failed parse — record nothing; the cluster pass already counts as a single attempt
        }
    }
}

const extractConceptsFromMetadata = (e: Episode): string[] => {
    const meta = e.metadata as {concepts?: unknown; term?: unknown; sender?: unknown; channel?: unknown} | undefined;
    if (Array.isArray(meta?.concepts)) {
        return meta.concepts.filter((c): c is string => typeof c === 'string');
    }
    if (typeof meta?.term === 'string') return [meta.term];
    const word = e.content.match(/[A-Za-z][A-Za-z0-9_-]{1,30}/g);
    return word ? word.slice(0, 5) : [];
};
