import type {ReasoningArtifact, ToolError, Route} from '../types.js';
import type {ConversationState} from '../ConversationState.js';
import type {ModelEvent} from '../model/ModelRunner.js';
import type {WorkingMemory} from './WorkingMemory.js';
import type {ReasoningTrace} from './ReasoningTrace.js';
import type {ReflectionVerdict} from './ReflectionStage.js';

export interface EpisodeContext {
    sender?: string;
    connectionType?: string;
    conversation?: ConversationState;
    reasoningDepth?: number;
    routeOverride?: Route['kind'];
    onEvent?: (event: ModelEvent) => void;
    lastInputAt?: number;
    signal?: AbortSignal;
    workingMemory?: WorkingMemory;
    skipReflection?: boolean;
}

export interface TurnResult {
    text: string;
    toolCalls: Array<{toolName: string; toolCallId: string; args: Record<string, unknown>}>;
    artifacts: ReasoningArtifact[];
    errors: ToolError[];
    route: Route;
    ctxHash: string;
    metrics: {durationMs: number; cycleCount: number; eventCount: number};
}

export interface EpisodeResult extends Omit<TurnResult, 'metrics'> {
    route: Route;
    ctxHash: string;
    verdict: ReflectionVerdict;
    trace: ReasoningTrace;
    workingMemory: WorkingMemory;
    metrics: {durationMs: number; cycleCount: number; eventCount: number};
}
