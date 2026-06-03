import type {ComposedRequest, CognitiveSnapshotData, RequestComposerDeps, Route} from '../types.js';
import {buildCtxHash} from './CognitiveSnapshot.js';

const MAX_HISTORY_DEFAULT = 20;
const SYSTEM_HEADROOM = 0.4;
const SNAPSHOT_HEADROOM = 0.3;
const HISTORY_HEADROOM = 0.3;
const APPROX_CHARS_PER_TOKEN = 4;
const SNAPSHOT_TRIM_KEYS: Array<keyof CognitiveSnapshotData> = ['episodes', 'questions', 'goals', 'attention'];

/**
 * Pure composer. Builds `{system, messages, tools, ctxHash, snapshot, budget}`
 * deterministically from its inputs. No I/O, no side effects, no class state.
 *
 * Budget cascade (Phase 4): if the system + history estimate exceeds
 * `maxContextTokens`, drop oldest history first, then progressively
 * drop snapshot detail levels in the order `episodes > questions >
 * goals > attention` until the total fits.
 */
export function compose(
    input: string,
    route: Route,
    deps: RequestComposerDeps & {
        tools: Record<string, unknown>;
        maxHistory?: number;
        historyOverride?: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[]; timestamp?: number}>;
        lastInputAt?: number;
    },
): ComposedRequest {
    const maxCtx = deps.maxContextTokens ?? 2048;
    const maxHistory = deps.maxHistory ?? MAX_HISTORY_DEFAULT;
    const conversation = deps.conversation;

    const history = deps.historyOverride ?? (conversation ? conversation.getHistory(maxHistory) : []);
    const historyMessages = history.map(h => ({role: h.role, content: h.content, ...(h.timestamp ? {timestamp: h.timestamp} : {})}));

    let workingSnapshot: CognitiveSnapshotData | null = deps.snapshot ? {...deps.snapshot} : null;
    let workingHistory = historyMessages;
    const userMessage = {role: 'user' as const, content: input};

    let system = buildSystemPrompt({deps, snapshot: workingSnapshot, route});
    let systemTokens = estTokens(system);

    const cascade = cascadeBudget({
        maxCtx,
        maxHistory,
        systemHeadroom: SYSTEM_HEADROOM,
        snapshotHeadroom: SNAPSHOT_HEADROOM,
        historyHeadroom: HISTORY_HEADROOM,
        systemTokens,
        snapshotTokens: workingSnapshot?.tokens ?? 0,
        history: workingHistory,
        userMessage,
        snapshot: workingSnapshot,
    });

    workingHistory = cascade.trimmedHistory;
    workingSnapshot = cascade.trimmedSnapshot;
    system = buildSystemPrompt({deps, snapshot: workingSnapshot, route});
    systemTokens = estTokens(system);

    const ctxHash = buildCtxHash(route, deps.nar, deps.lastInputAt ?? Date.now());
    const historyTokens = estTokens(JSON.stringify(workingHistory.concat([userMessage])));
    const snapshotTokens = workingSnapshot?.tokens ?? 0;

    return {
        system,
        messages: [...workingHistory, userMessage],
        tools: deps.tools,
        ctxHash,
        snapshot: workingSnapshot,
        budget: {
            systemTokens,
            historyTokens,
            snapshotTokens,
            total: systemTokens + historyTokens + snapshotTokens,
            maxTokens: maxCtx,
        },
    };
}

function buildSystemPrompt({deps, snapshot, route}: {deps: RequestComposerDeps; snapshot: CognitiveSnapshotData | null; route: Route}): string {
    const mode = deps.config?.reasoning?.autoTrigger === false ? 'senars-only' : 'full';
    const base = deps.instructions ?? defaultInstructions(mode, route);
    if (!snapshot) return base;
    return `${base}\n\n## Current Cognitive State\n${formatSnapshot(snapshot)}`;
}

function defaultInstructions(mode: string, route: Route): string {
    const ctx = ` (routed: ${route.kind}, conf=${route.confidence.toFixed(2)})`;
    if (mode === 'senars-only') return `SeNARS Reasoning Engine — Narsese Input Mode${ctx}`;
    if (mode === 'lm-only') return `You are a helpful conversational AI assistant.${ctx}`;
    return `You are SeNARS — a neurosymbolic cognitive kernel that fuses a language model with a NARS reasoning engine.${ctx}\n\nYou can call NARS tools (nar_believe, nar_query, nar_question, nar_reason) when formal logic is needed. You can also answer from your own knowledge. Be concise. Surface uncertainty.`;
}

function formatSnapshot(snap: CognitiveSnapshotData): string {
    const out: string[] = [];
    if (snap.attention.length > 0) {
        out.push('## Current Attention Focus');
        for (const c of snap.attention) {
            const t = c.truth ? ` (f=${c.truth.f.toFixed(2)}, c=${c.truth.c.toFixed(2)})` : '';
            out.push(`- **${c.term}**: priority=${c.priority.toFixed(2)}${t}`);
        }
    }
    if (snap.questions.length > 0) {
        out.push('\n## Unanswered Questions');
        for (const q of snap.questions) out.push(`- ${q}`);
    }
    if (snap.goals.length > 0) {
        out.push('\n## Active Goals');
        for (const g of snap.goals) out.push(`- ${g}`);
    }
    out.push(`\n## Memory State`);
    out.push(`- Concepts: ${snap.memory.totalConcepts}`);
    out.push(`- Tasks: ${snap.memory.totalTasks}`);
    out.push(`- Working Memory: ${snap.memory.workingMemorySize}`);
    if (snap.episodes.length > 0) {
        out.push('\n## Recent Episodic Memories');
        for (const e of snap.episodes) out.push(`- [${new Date(e.timestamp).toISOString()}] ${e.type}: ${e.summary}`);
    }
    if (snap.summary) out.push(`\n## Conversation Summary\n${snap.summary}`);
    if (snap.pinnedBeliefs.length > 0) {
        out.push('\n## Pinned Beliefs');
        for (const b of snap.pinnedBeliefs) out.push(`- ${b}`);
    }
    if (snap.priorInsights && snap.priorInsights.length > 0) {
        out.push('\n## Other things I have been thinking about');
        for (const i of snap.priorInsights) out.push(`- ${i}`);
    }
    return out.join('\n');
}

function cascadeBudget(args: {
    maxCtx: number;
    maxHistory: number;
    systemHeadroom: number;
    snapshotHeadroom: number;
    historyHeadroom: number;
    history: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[]; timestamp?: number}>;
    userMessage: {role: 'user'; content: string};
    systemTokens: number;
    snapshotTokens: number;
    snapshot: CognitiveSnapshotData | null;
}): {trimmedHistory: typeof args.history; trimmedSnapshot: CognitiveSnapshotData | null} {
    let history = args.history;
    let snapshot = args.snapshot;
    const historyBudget = Math.floor(args.maxCtx * args.historyHeadroom);
    const snapshotBudget = Math.floor(args.maxCtx * args.snapshotHeadroom);
    let historyTokens = estTokens(JSON.stringify(history));
    let snapshotTokens = snapshot?.tokens ?? 0;

    while (history.length > 0 && historyTokens > historyBudget) history = history.slice(1), historyTokens = estTokens(JSON.stringify(history));
    while (history.length > args.maxHistory) history = history.slice(1);

    let cycles = 0;
    while (snapshot && snapshotTokens > snapshotBudget && cycles < SNAPSHOT_TRIM_KEYS.length) {
        const key = SNAPSHOT_TRIM_KEYS[cycles]!;
        const v = snapshot[key];
        if (Array.isArray(v) && v.length > 0) {
            (snapshot as unknown as Record<string, unknown>)[key] = v.slice(0, Math.max(0, v.length - 1));
        }
        snapshot = {...snapshot, tokens: estimateSnapshotTokens(snapshot)};
        snapshotTokens = snapshot.tokens;
        cycles++;
    }
    return {trimmedHistory: history, trimmedSnapshot: snapshot};
}

function estimateSnapshotTokens(snap: CognitiveSnapshotData): number {
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

function estTokens(s: string): number {
    return Math.ceil(s.length / APPROX_CHARS_PER_TOKEN);
}
