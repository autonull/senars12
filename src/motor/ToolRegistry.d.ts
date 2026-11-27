import type { SkillFeedback, ToolFeedbackObserver } from '@senars/feedback';
import type { ToolCapabilities, ToolContext, ToolFn, ToolSpec, ToolResult } from '@senars/types/tools';
/**
 * The tool contract and the feedback record are util's. The contract was declared
 * here *and* in nar's tools module with the same five fields and two different
 * `execute` signatures — one taking `(correlationId, signal)`, the other a
 * `ToolContext` — so crossing the delegation seam cost a hand-written mapping in
 * both directions plus two casts over `parameters`; a call now carries its
 * provenance and cancellation in the context, so the two registries speak one
 * type and the adapter adapts a call. The feedback record had a second,
 * field-for-field identical declaration here, and a five-field record a tool
 * result crosses on every call is two places to forget a field.
 */
export type { SkillFeedback, ToolCapabilities, ToolContext, ToolFn, ToolSpec };
/** Delegate interface for the unified tool registry (nar's ToolManager). */
export interface ToolRegistryDelegate {
    register(tool: ToolSpec): void;
    unregister(name: string): void;
    get(name: string): ToolSpec | undefined;
    list(): ToolSpec[];
    execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;
    getFeedback(name: string): SkillFeedback | undefined;
    getAllFeedback(): SkillFeedback[];
    getRecentResults(limit: number): string;
    clear(): void;
}
export declare class ToolRegistry implements ToolRegistryDelegate {
    #private;
    constructor(feedbackObserver?: ToolFeedbackObserver, delegate?: ToolRegistryDelegate);
    /** Set the delegate registry (e.g., nar's ToolManager) after construction. */
    setDelegate(delegate: ToolRegistryDelegate): void;
    private target;
    register(spec: ToolSpec): void;
    unregister(name: string): void;
    get(name: string): ToolSpec | undefined;
    list(): ToolSpec[];
    execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;
    private executeLocal;
    getFeedback(name: string): SkillFeedback | undefined;
    getAllFeedback(): SkillFeedback[];
    getRecentResults(limit: number): string;
    clear(): void;
}
//# sourceMappingURL=ToolRegistry.d.ts.map