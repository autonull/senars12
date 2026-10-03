import type { ToolResult } from '../types/engine.js';
import { selectTopN } from '../utils/collections.js';

export interface ToolFeedback {
  name: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  totalDuration: number;
  averageDuration: number;
  lastCalled: number;
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

export class DefaultToolFeedbackObserver implements ToolFeedbackObserver {
  private feedback = new Map<string, ToolFeedback>();

  recordCall(name: string, result: ToolResult, duration: number): void {
    const existing = this.feedback.get(name);
    const totalCalls = (existing?.totalCalls ?? 0) + 1;
    const successfulCalls = (existing?.successfulCalls ?? 0) + (result.success ? 1 : 0);
    const failedCalls = (existing?.failedCalls ?? 0) + (result.success ? 0 : 1);
    const successRate = successfulCalls / totalCalls;
    const totalDuration = (existing?.totalDuration ?? 0) + duration;
    const averageDuration = totalDuration / totalCalls;
    const lastResult = result.success ? String(result.content ?? '') : '';
    const lastError = result.success ? undefined : (result.error ?? 'Unknown error');

    this.feedback.set(name, {
      name,
      totalCalls,
      successfulCalls,
      failedCalls,
      successRate,
      totalDuration,
      averageDuration,
      lastCalled: Date.now(),
      lastResult,
      lastError,
    });
  }

  getFeedback(name: string): ToolFeedback | undefined {
    return this.feedback.get(name);
  }

  getAllFeedback(): ToolFeedback[] {
    return Array.from(this.feedback.values());
  }

  getFeedbackString(limit: number): string {
    return selectTopN(this.feedback.values(), limit, (f) => f.totalCalls)
      .map((f) => `${f.name}: ${f.lastResult || f.lastError || 'no result'}`)
      .join('\n');
  }

  resetFeedback(name?: string): void {
    if (name) {
      this.feedback.delete(name);
    } else {
      this.feedback.clear();
    }
  }
}
