import type {NAR} from '../../nar/nar.js';
import type {EpisodicMemory} from '../../nar/memory/EpisodicMemory.js';
import type {LMClient} from '../../nar/lm/types.js';
import {EventBus} from '../../nar/types/events.js';
import {compose} from '../request/RequestComposer.js';
import {CognitiveSnapshot, buildCtxHash} from '../request/CognitiveSnapshot.js';
import {ModelRunner, type ModelEvent} from '../model/ModelRunner.js';
import type {AIAgentConfig, ReasoningArtifact, Route, ComposedRequest} from '../types.js';
import type {ConversationState} from '../ConversationState.js';
import {WorkingMemory} from './WorkingMemory.js';
import {ReasoningTrace} from './ReasoningTrace.js';
import type {EpisodeContext, TurnResult} from './EpisodeTypes.js';

export interface EpisodeRunnerDeps {
    nar?: NAR;
    episodicMemory?: EpisodicMemory;
    lmClient?: LMClient;
    config: AIAgentConfig['config'];
    eventBus: EventBus;
    snapshot: CognitiveSnapshot;
    runner: ModelRunner;
    nextTurn: () => number;
    nextCycle: () => number;
    markActivity: () => void;
    primeAttention: (input: string) => void;
    buildTools: (wm: WorkingMemory) => Record<string, unknown>;
    absorbModelMessages: (conversation: ConversationState, modelResult: {messages: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[]}>; artifacts: ReasoningArtifact[]}) => void;
    pinTopBeliefs: (conversation: ConversationState, artifacts: ReasoningArtifact[]) => void;
    scheduleSummarize: (conversation: ConversationState) => void;
}

export class EpisodeRunner {
    constructor(private readonly deps: EpisodeRunnerDeps) {}

    async runModelCandidate(
        input: string,
        r: Route,
        ctx: EpisodeContext,
        start: number,
        wm: WorkingMemory,
        trace: ReasoningTrace,
        emit: (e: ModelEvent) => void,
        signal: AbortSignal,
    ): Promise<TurnResult> {
        const {nar, episodicMemory, snapshot, runner, config, eventBus} = this.deps;
        const sender = ctx.sender ?? 'user';
        const connectionType = ctx.connectionType ?? 'cli';
        const conversation = ctx.conversation;
        const lastInputAt = ctx.lastInputAt ?? Date.now();
        const ctxHash = buildCtxHash(r, nar, lastInputAt);
        const snap = await snapshot.get({
            nar,
            episodicMemory,
            ctxHash,
            ...(conversation?.summary ? {summary: conversation.summary} : {}),
            ...(conversation ? {pinnedBeliefs: conversation.getPinned()} : {}),
            priorInsights: (wm.get<string[]>('prior_insights') ?? []) as string[],
        });
        if (nar) this.deps.primeAttention(input);
        await episodicMemory?.log('input', input, {sender, channel: connectionType});
        if (conversation) conversation.addMessage({role: 'user', content: input, timestamp: lastInputAt});

        const tools = this.deps.buildTools(wm);
        const composed: ComposedRequest = compose(input, r, {
            nar,
            episodicMemory,
            conversation,
            config,
            snapshot: snap,
            tools,
            lastInputAt,
            maxContextTokens: 2048,
        });
        trace.recordCompose(composed);

        const iter = runner.run(composed, signal);
        let next = await iter.next();
        while (!next.done) {
            trace.recordEvent(next.value);
            emit(next.value);
            next = await iter.next();
        }
        const modelResult = next.value;

        const responseText = modelResult.text || 'No response generated.';
        await episodicMemory?.log('response', responseText, {sender, channel: connectionType});
        const cycle = this.deps.nextCycle();
        this.deps.nextTurn();
        this.deps.markActivity();
        if (conversation) {
            this.deps.absorbModelMessages(conversation, modelResult);
            this.deps.pinTopBeliefs(conversation, modelResult.artifacts);
            this.deps.scheduleSummarize(conversation);
        }
        eventBus.emit('agent:turn:complete', {text: responseText, ctxHash, route: r.kind});

        return {
            text: responseText,
            toolCalls: modelResult.toolCalls,
            artifacts: modelResult.artifacts,
            errors: modelResult.errors,
            route: r,
            ctxHash,
            metrics: {durationMs: Date.now() - start, cycleCount: cycle, eventCount: 0},
        };
    }

    async runNoModelCandidate(input: string, r: Route, ctx: EpisodeContext, start: number): Promise<TurnResult> {
        const {nar} = this.deps;
        if (!nar) {
            return {
                text: 'NAR not initialized',
                toolCalls: [],
                artifacts: [],
                errors: [],
                route: r,
                ctxHash: buildCtxHash(r, undefined, Date.now()),
                metrics: {durationMs: Date.now() - start, cycleCount: this.deps.nextCycle(), eventCount: 0},
            };
        }
        let text = '';
        if (r.kind === 'command') {
            text = `Command received: ${r.command} ${r.arguments?.join(' ') ?? ''}`.trim();
        } else if (r.kind === 'narsese-question') {
            const clean = input.replace(/[?!]+$/, '');
            const match = nar.getBeliefs().find(b => b.term.toString().includes(clean.split('-->')[0]?.trim() ?? clean));
            text = match ? `Answer: ${match.term.toString()} f=${match.truth?.f.toFixed(2) ?? '?'} c=${match.truth?.c.toFixed(2) ?? '?'}` : `No answer for: ${input}`;
        } else {
            const clean = input.replace(/[?!.]+$/, '');
            await nar.input(clean, 'belief');
            nar.run(ctx.reasoningDepth ?? 5).catch(() => undefined);
            text = `+ ${clean}`;
        }
        const cycle = this.deps.nextCycle();
        this.deps.nextTurn();
        this.deps.markActivity();
        return {
            text,
            toolCalls: [],
            artifacts: [],
            errors: [],
            route: r,
            ctxHash: buildCtxHash(r, nar, Date.now()),
            metrics: {durationMs: Date.now() - start, cycleCount: cycle, eventCount: 0},
        };
    }
}

function captureBeliefCount(nar: {getBeliefs(): unknown[]}): number {
    return nar.getBeliefs().length;
}

function captureDerivedBeliefs(
    nar: {getBeliefs(): Array<{term: {toString(): string}; truth?: {f: number; c: number}; derived?: boolean}>},
    before: number,
): Array<{term: string; truth?: {f: number; c: number}}> {
    const all = nar.getBeliefs();
    const fresh = all.slice(before);
    return fresh
        .filter(b => b.derived !== false)
        .map(b => ({term: b.term.toString(), ...(b.truth ? {truth: {f: b.truth.f, c: b.truth.c}} : {})}));
}
