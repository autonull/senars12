/**
 * Agent reasoning cycle as a `MacroPhase` middleware pipeline (REFACTOR.todo1
 * Phase A): `DEFAULT_MACRO_PIPELINE` reproduces the original `runCycleStream`
 * step sequence exactly; narration streams through the phase chain via
 * `MacroContext.stream`.
 */
import type { LMTask } from '@senars/types/llm';
import type { ChatStreamEvent } from './chat';
import type { CognitiveStimulus } from '@senars/types/cognitive';
import { type CycleHost, type MacroPhase } from './pipeline';
export type { CycleHost, MacroContext, MacroPhase } from './pipeline';
export { createCapturePhase, createReflectPhase } from './pipeline';
export declare const DEFAULT_MACRO_PIPELINE: MacroPhase[];
export declare const runCycle: (host: CycleHost, stimulus: CognitiveStimulus, phases?: readonly MacroPhase[]) => Promise<string>;
export declare function runCycleStream(host: CycleHost, stimulus: CognitiveStimulus, opts?: {
    signal?: AbortSignal;
    tier?: LMTask;
    pipeline?: readonly MacroPhase[];
}): AsyncGenerator<ChatStreamEvent, string>;
//# sourceMappingURL=phases.d.ts.map