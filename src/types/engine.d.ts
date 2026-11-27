import type { CognitiveStimulus, Context, Derivation } from './cognitive';
export type { CognitiveStimulus, Context, Derivation } from './cognitive';
export type EngineId = string;
/**
 * The one tool outcome shape. `partial`/`metadata` were `nar`'s additions and
 * `success`/`content`/`error` core's; the union of the two is what both already
 * handled at runtime.
 */
export interface ToolResult {
    success: boolean;
    content: unknown;
    error?: string;
    /** The tool returned usable output alongside its own failure. */
    partial?: boolean;
    metadata?: Record<string, unknown>;
}
/** A successful outcome. */
export declare const toolOk: (content: unknown, extra?: Partial<ToolResult>) => ToolResult;
/** A failed outcome; anything thrown is stringified at this boundary. */
export declare const toolError: (error: unknown, extra?: Partial<ToolResult>) => ToolResult;
/**
 * A tool body wrapped in its own failure contract. Every tool hand-wrote
 * `try { toolOk(await run()) } catch { toolError(\`${label}: ${errMsg(e)}\`) }`, and the
 * four labels in production code differed only in wording — two of them dropped
 * the label and reported a bare message. `label` is the parameter those four sites
 * were missing.
 */
export declare const toolAttempt: <T>(label: string, run: () => T | Promise<T>, content?: (value: T) => unknown) => Promise<ToolResult>;
export interface Engine {
    readonly id: EngineId;
    reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
    query(pattern: string): Promise<unknown[]>;
    absorb?(result: ToolResult): void;
    persist?(): Promise<void>;
    load?(): Promise<void>;
}
//# sourceMappingURL=engine.d.ts.map