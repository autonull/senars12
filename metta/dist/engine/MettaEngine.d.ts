import type { CognitiveStimulus, Context, Derivation, EngineId, ToolResult } from '@senars/core/engine';
import { BaseEngine } from '@senars/core/engine/base';
import { type MeTTaRuntime } from '../runtime/builder.js';
export declare class MettaEngine extends BaseEngine {
    #private;
    readonly id: EngineId;
    readonly provides: Set<string>;
    constructor(runtime?: MeTTaRuntime);
    get runtime(): MeTTaRuntime | null;
    protected doInitialize(): Promise<void>;
    protected doShutdown(): Promise<void>;
    reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
    query(pattern: string): Promise<unknown[]>;
    protected doAbsorb(result: ToolResult): void;
    persist(): Promise<void>;
    load(): Promise<void>;
}
//# sourceMappingURL=MettaEngine.d.ts.map