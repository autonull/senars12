import type { ToolResult } from '@senars/types/engine';
import { type CallTally } from '@senars/util/tally';
export interface ToolFeedback extends CallTally {
    name: string;
    lastResult: string;
    lastError?: string;
}
export interface SkillFeedback {
    skill: string;
    lastResult: string;
    successRate: number;
    callCount: number;
    lastError?: string;
}
export declare const toSkillFeedback: (fb: ToolFeedback) => SkillFeedback;
export interface ToolFeedbackObserver {
    recordCall(name: string, result: ToolResult, duration: number): void;
    getFeedback(name: string): ToolFeedback | undefined;
    getAllFeedback(): ToolFeedback[];
    getFeedbackString(limit: number): string;
    resetFeedback(name?: string): void;
}
export declare class DefaultToolFeedbackObserver implements ToolFeedbackObserver {
    private readonly feedback;
    recordCall(name: string, result: ToolResult, duration: number): void;
    getFeedback(name: string): ToolFeedback | undefined;
    getAllFeedback(): ToolFeedback[];
    getFeedbackString(limit: number): string;
    resetFeedback(name?: string): void;
}
//# sourceMappingURL=ToolFeedbackObserver.d.ts.map