import type {NAR} from '../../nar/nar.js';
import {route} from '../routing/InputRouter.js';
import {buildCtxHash} from '../request/CognitiveSnapshot.js';
import {ReasoningTrace} from './ReasoningTrace.js';
import {WorkingMemory} from './WorkingMemory.js';
import type {ReflectionVerdict} from './ReflectionStage.js';
import type {EpisodeContext, EpisodeResult, TurnResult} from './EpisodeTypes.js';
import type {Route} from '../types.js';

export function finalizeEpisode(
    candidate: TurnResult,
    verdict: ReflectionVerdict,
    artifacts: EpisodeResult['artifacts'],
    wm: WorkingMemory,
    trace: ReasoningTrace,
    _ctx: EpisodeContext,
    start: number,
    eventCount: number,
    cycleCount: number,
): EpisodeResult {
    trace.recordFinalize(artifacts, candidate.errors);
    return {
        text: candidate.text,
        toolCalls: candidate.toolCalls,
        artifacts,
        errors: candidate.errors,
        route: candidate.route,
        ctxHash: candidate.ctxHash,
        verdict,
        trace,
        workingMemory: wm,
        metrics: {durationMs: Date.now() - start, cycleCount, eventCount},
    };
}

export function abortedResult(
    input: string,
    ctx: EpisodeContext,
    start: number,
    cycleCount: number,
    routeOverride?: Route,
    trace?: ReasoningTrace,
    nar?: NAR,
): EpisodeResult {
    const emptyRoute: Route = routeOverride ?? route(input, {sender: ctx.sender});
    const wm = new WorkingMemory();
    const t = trace ?? new ReasoningTrace();
    return {
        text: '[aborted]',
        toolCalls: [],
        artifacts: [],
        errors: [{toolCallId: '', toolName: '', message: 'aborted'}],
        route: emptyRoute,
        ctxHash: buildCtxHash(emptyRoute, nar, Date.now()),
        verdict: {action: 'accept'},
        trace: t,
        workingMemory: wm,
        metrics: {durationMs: Date.now() - start, cycleCount, eventCount: 0},
    };
}

export function yieldToEventLoop(): Promise<void> {
    return new Promise<void>(resolve => setImmediate(resolve));
}
