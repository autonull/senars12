import type { SkillFeedback, ToolRegistryDelegate, ToolSpec } from '@senars/core/motor';
import { toSkillFeedback } from '@senars/util';
import type { ToolContext, ToolResult } from '@senars/util';
import type { ToolManager } from './ToolManager';

/**
 * Makes nar's `ToolManager` satisfy core's `ToolRegistryDelegate`.
 *
 * There is no record mapping here, because there is no second record to map:
 * both sides declare util's `ToolSpec`, so a nar tool *is* a core spec and a
 * core spec *is* a nar tool. What the delegate's old signature could not carry
 * — the correlation id beside the abort signal — rides in the `ToolContext` the
 * contract already defines, so a call crosses with its provenance intact.
 */
export class CoreToolRegistryAdapter implements ToolRegistryDelegate {
  constructor(private readonly manager: ToolManager) {}

  register(spec: ToolSpec): void {
    this.manager.register(spec);
  }

  unregister(name: string): void {
    this.manager.unregister(name);
  }

  get(name: string): ToolSpec | undefined {
    return this.manager.get(name);
  }

  list(): ToolSpec[] {
    return this.manager.list();
  }

  execute(
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolResult> {
    return this.manager.execute(name, args, context);
  }

  getFeedback(name: string): SkillFeedback | undefined {
    const fb = this.manager.getFeedback(name);
    return fb ? toSkillFeedback(fb) : undefined;
  }

  getAllFeedback(): SkillFeedback[] {
    return this.manager.getAllFeedback().map(toSkillFeedback);
  }

  getRecentResults(limit: number): string {
    return this.manager.getRecentFeedbackString(limit);
  }

  clear(): void {
    for (const tool of this.manager.list()) {
      this.manager.unregister(tool.name);
    }
  }
}