import type { ToolResult } from '../engine/Engine.js';

export type ToolFn = (
  args: Record<string, unknown>,
  correlationId?: string
) => Promise<ToolResult> | ToolResult;

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: ToolFn;
}

export interface SkillFeedback {
  skill: string;
  lastResult: string;
  successRate: number;
  callCount: number;
  lastError?: string;
}

export class ToolRegistry {
  #tools = new Map<string, ToolSpec>();
  #feedback = new Map<string, SkillFeedback>();

  register(spec: ToolSpec): void {
    this.#tools.set(spec.name, spec);
  }

  get(name: string): ToolSpec | undefined {
    return this.#tools.get(name);
  }

  list(): ToolSpec[] {
    return [...this.#tools.values()];
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    correlationId?: string
  ): Promise<ToolResult> {
    const tool = this.#tools.get(name);
    if (!tool) return { success: false, content: null, error: `Unknown tool: ${name}` };

    const start = Date.now();
    try {
      const result = await tool.execute(args, correlationId);
      const duration = Date.now() - start;
      const prev = this.#feedback.get(name);
      const callCount = (prev?.callCount ?? 0) + 1;
      const successRate = prev ? (prev.successRate * (callCount - 1) + 1) / callCount : 1;
      this.#feedback.set(name, {
        skill: name,
        lastResult: String(result.content),
        successRate,
        callCount,
      });
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      const prev = this.#feedback.get(name);
      const callCount = (prev?.callCount ?? 0) + 1;
      const successRate = prev ? (prev.successRate * (callCount - 1)) / callCount : 0;
      this.#feedback.set(name, {
        skill: name,
        lastResult: '',
        successRate,
        callCount,
        lastError: (err as Error).message,
      });
      return { success: false, content: null, error: (err as Error).message };
    }
  }

  getFeedback(name: string): SkillFeedback | undefined {
    return this.#feedback.get(name);
  }

  getAllFeedback(): SkillFeedback[] {
    return [...this.#feedback.values()];
  }

  getRecentResults(limit: number): string {
    return [...this.#feedback.values()]
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, limit)
      .map((f) => `${f.skill}: ${f.lastResult}`)
      .join('\n');
  }

  clear(): void {
    this.#tools.clear();
    this.#feedback.clear();
  }
}
