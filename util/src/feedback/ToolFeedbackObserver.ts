import type { ToolResult } from '../types/engine.js';
import { selectTopN } from '../utils/collections.js';
import { type CallTally, CallTallySeries, createCallTally } from '../utils/tally.js';

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

export const toSkillFeedback = (fb: ToolFeedback): SkillFeedback => ({
  skill: fb.name,
  lastResult: fb.lastResult,
  successRate: fb.successRate,
  callCount: fb.totalCalls,
  lastError: fb.lastError,
});

export interface ToolFeedbackObserver {
  recordCall(name: string, result: ToolResult, duration: number): void;
  getFeedback(name: string): ToolFeedback | undefined;
  getAllFeedback(): ToolFeedback[];
  getFeedbackString(limit: number): string;
  resetFeedback(name?: string): void;
}

/** Tool names arrive out of model output, so the series is capacity-bounded. */
const MAX_TRACKED_TOOLS = 256;

export class DefaultToolFeedbackObserver implements ToolFeedbackObserver {
  private readonly feedback = new CallTallySeries<string, ToolFeedback>({
    maxSize: MAX_TRACKED_TOOLS,
    create: (name) => ({ ...createCallTally(), name, lastResult: '' }),
  });

  recordCall(name: string, result: ToolResult, duration: number): void {
    const feedback = this.feedback.record(name, result.success, duration);
    feedback.lastResult = result.success ? String(result.content ?? '') : '';
    feedback.lastError = result.success ? undefined : (result.error ?? 'Unknown error');
  }

  getFeedback(name: string): ToolFeedback | undefined {
    return this.feedback.get(name);
  }

  getAllFeedback(): ToolFeedback[] {
    return [...this.feedback.values()];
  }

  getFeedbackString(limit: number): string {
    return selectTopN(this.feedback.values(), limit, (f) => f.totalCalls)
      .map((f) => `${f.name}: ${f.lastResult || f.lastError || 'no result'}`)
      .join('\n');
  }

  resetFeedback(name?: string): void {
    this.feedback.reset(name);
  }
}
