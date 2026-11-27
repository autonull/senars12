import type { EpisodicMemory } from '@senars/types/episodic-memory';
import type { ApprovalService } from '../agent/ApprovalService';
import type { ToolSpec } from './ToolRegistry';
export type CmdArgSet = Record<string, unknown>;
export interface BuiltinDeps {
    episodic?: EpisodicMemory;
    metta?: (expression: string) => Promise<unknown[]>;
    pins?: PinStore;
}
export interface PinStore {
    pin(key: string, value: string): void;
    unpin(key?: string): void;
    recallAll(): Map<string, string>;
}
export declare const createBuiltinTools: (deps?: BuiltinDeps) => ToolSpec[];
export declare const BUILTIN_TOOLS: ToolSpec[];
export declare function registerBuiltinTools(registry: {
    register: (spec: ToolSpec) => void;
}, approvalService?: ApprovalService, deps?: BuiltinDeps): void;
//# sourceMappingURL=builtin-tools.d.ts.map