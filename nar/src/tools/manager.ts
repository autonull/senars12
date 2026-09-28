import type { ToolFeedback, ToolFeedbackObserver } from '@senars/util/feedback';
import { DefaultToolFeedbackObserver } from '@senars/util/feedback';
import { SenarsError } from '@senars/util/errors';
import { createLogger } from '@senars/core/logger';
import { BoundedRing } from '../utils/collections.js';
import type { Term } from '../terms';
import type { EventBus, NAREventMap } from '../types';
import type { RandomSource } from '../types/primitives.js';
import { executeToolGoal } from './goal';
import { Registry, type ToolDescriptor } from './registry';
import type {
  Tool,
  ToolChainResult,
  ToolChainStep,
  ToolContext,
  ToolEvent,
  ToolFilter,
  ToolResult,
} from './types';
import { errorResult } from './types';

const logger = createLogger({ scope: 'ToolManager' });

type LifecycleState = 'initialized' | 'running' | 'stopped' | 'disposed';

export class ToolManager {
  /** Bounded execution-history ring (drop-oldest). */
  static readonly MAX_HISTORY = 100;

  private readonly registry = new Registry();
  private readonly executionHistory = new BoundedRing<ToolEvent>(ToolManager.MAX_HISTORY);
  private readonly allowedPermissions = new Set<string>();
  private readonly toolDescriptors = new Map<string, ToolDescriptor>();
  private readonly lifecycleState = new Map<string, LifecycleState>();
  private readonly sandboxMode: boolean;
  private eventBus?: EventBus<NAREventMap>;
  private readonly feedback: ToolFeedbackObserver;
  private readonly rng: RandomSource;

  constructor(options?: {
    sandboxMode?: boolean;
    allowedPermissions?: string[];
    eventBus?: EventBus<NAREventMap>;
    feedbackObserver?: ToolFeedbackObserver;
    /** §5s: injectable RNG for `random` conflict resolution. */
    rng?: RandomSource;
  }) {
    this.sandboxMode = options?.sandboxMode ?? false;
    this.eventBus = options?.eventBus;
    this.feedback = options?.feedbackObserver ?? new DefaultToolFeedbackObserver();
    this.rng = options?.rng ?? Math.random;
    for (const p of options?.allowedPermissions ?? []) {
      this.allowedPermissions.add(p);
    }
  }

  setEventBus(eventBus: EventBus<NAREventMap>): void {
    this.eventBus = eventBus;
  }

  on<K extends keyof NAREventMap & string>(
    event: K,
    callback: (data: NAREventMap[K]) => void
  ): void {
    this.eventBus?.on(event, callback);
  }

  register(tool: Tool, descriptor?: ToolDescriptor): void {
    this.registry.register(tool);
    this.lifecycleState.set(tool.name, 'initialized');
    const resolvedDescriptor = descriptor ?? {
      name: tool.name,
      description: tool.description,
      capabilities: tool.capabilities,
      tags: tool.tags ?? [],
      version: '1.0.0',
    };
    this.toolDescriptors.set(tool.name, resolvedDescriptor);
    this.emit('tool:register', { name: tool.name, descriptor: resolvedDescriptor });
  }

  unregister(name: string): void {
    this.stopTool(name);
    this.registry.unregister(name);
    this.feedback.resetFeedback(name);
    this.lifecycleState.delete(name);
    this.toolDescriptors.delete(name);
    this.emit('tool:unregister', { name });
  }

  async initializeTool(name: string): Promise<boolean> {
    const tool = this.get(name);
    const ls = this.lifecycleState.get(name);
    if (!tool || ls === 'running' || ls === 'disposed') return false;

    if (
      tool.capabilities?.requiresPermissions &&
      !tool.capabilities.requiresPermissions.every((p) => this.allowedPermissions.has(p))
    ) {
      return false;
    }
    this.lifecycleState.set(name, 'running');
    this.emitState(name, 'running');
    return true;
  }

  async stopTool(name: string): Promise<boolean> {
    if (this.lifecycleState.get(name) !== 'running') return false;
    this.lifecycleState.set(name, 'stopped');
    this.emitState(name, 'stopped');
    return true;
  }

  async disposeTool(name: string): Promise<boolean> {
    if (this.lifecycleState.get(name) === 'disposed') return true;
    this.lifecycleState.set(name, 'disposed');
    this.emitState(name, 'disposed');
    return true;
  }

  getToolDescriptor(name: string): ToolDescriptor | undefined {
    return this.toolDescriptors.get(name);
  }

  discoverTools(filter?: { tags?: string[]; capabilities?: string[] }): ToolDescriptor[] {
    const all = Array.from(this.toolDescriptors.values());
    if (!filter) return all;

    return all.filter((desc) => {
      if (filter.tags && !filter.tags.every((tag) => desc.tags?.includes(tag))) return false;
      if (filter.capabilities) {
        const caps = desc.capabilities;
        if (!caps) return false;
        if (filter.capabilities.some((c) => c === 'pure' && !caps.pure)) return false;
        if (filter.capabilities.some((c) => c === 'readOnly' && !caps.readOnly)) return false;
      }
      return true;
    });
  }

  resolveConflict(
    tools: string[],
    context?: { preference?: 'first' | 'best' | 'random' }
  ): string | null {
    if (tools.length <= 1) return tools[0] ?? null;
    const preference = context?.preference || 'first';

    if (preference === 'best') {
      let best: string | null = null;
      let bestScore = -1;
      for (const name of tools) {
        const seen = this.getFeedback(name);
        const score = seen?.successRate ?? 0;
        if (score > bestScore) {
          bestScore = score;
          best = name;
        }
      }
      return best || tools[0]!;
    }

    if (preference === 'random') {
      return tools[Math.floor(this.rng() * tools.length)]!;
    }

    return tools[0]!;
  }

  get(name: string): Tool | undefined {
    return this.registry.get(name);
  }

  list(filter?: ToolFilter): Tool[] {
    const all = this.registry.list();
    if (!filter) return all;

    return all.filter((tool) => {
      if (filter.tags && !filter.tags.every((tag) => tool.tags?.includes(tag))) return false;
      if (filter.readOnly && tool.capabilities?.readOnly !== true) return false;
      return true;
    });
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context?: ToolContext
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.get(name);
    if (!tool) return errorResult(`Tool '${name}' not found`);

    const state = this.lifecycleState.get(name);
    if (state !== 'running' && state !== 'initialized') {
      return errorResult(`Tool '${name}' is not running (state: ${state})`);
    }

    if (this.sandboxMode && context?.permissions) {
      const required = tool.capabilities?.requiresPermissions || [];
      if (!required.every((p) => context.permissions?.has(p))) {
        return errorResult(`Missing required permissions: ${required.join(', ')}`);
      }
    }

    const budget = context?.budget;
    if (budget) {
      budget.executions = (budget.executions || 0) + 1;
      if (budget.maxExecutions && budget.executions > budget.maxExecutions) {
        return errorResult('Execution budget exceeded');
      }
    }

    // Check for abort signal
    if (context?.signal?.aborted) {
      return errorResult('Execution aborted');
    }

    const baseEvent = { name, args, timestamp: startTime, context } as const;
    this.emit('tool:call', { type: 'tool_call', ...baseEvent });
    this.addToHistory({ type: 'tool_call', ...baseEvent });

    try {
      const result = await this.registry.execute(name, args, context);
      const duration = Date.now() - startTime;
      const resultEvent: ToolEvent = {
        type: 'tool_result',
        ...baseEvent,
        result,
        timestamp: Date.now(),
        duration,
      };

      if (budget) {
        budget.totalDuration = (budget.totalDuration || 0) + duration;
        if (budget.maxTotalDuration && budget.totalDuration > budget.maxTotalDuration) {
          result.error = 'Duration budget exceeded';
          result.success = false;
        }
      }

      this.feedback.recordCall(name, result, duration);
      this.emit('tool:result', { ...resultEvent, duration });
      this.addToHistory(resultEvent);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const result = { success: false, content: null, error: errorMsg };
      const errorEvent: ToolEvent = {
        type: 'tool_error',
        ...baseEvent,
        result,
        timestamp: Date.now(),
        duration,
      };

      this.feedback.recordCall(name, result, duration);
      this.emit('tool:error', { ...errorEvent, duration });
      this.addToHistory(errorEvent);
      throw SenarsError.wrap(error, { tool: name, operation: 'execute' }, 'TOOL_ERROR');
    }
  }

  executeChain = (chain: ToolChainStep[]): Promise<ToolChainResult> =>
    this.registry.executeChain(chain);

  getFeedback(name: string): ToolFeedback | undefined {
    return this.feedback.getFeedback(name);
  }

  getAllFeedback(): ToolFeedback[] {
    return this.feedback.getAllFeedback();
  }

  /** Get recent feedback as a string (for context injection) */
  getRecentFeedbackString(limit: number): string {
    return this.feedback.getFeedbackString(limit);
  }

  getHistory(limit = 10): ToolEvent[] {
    return this.executionHistory.tail(limit);
  }

  clearHistory(): void {
    this.executionHistory.clear();
  }

  executeToolGoal(goalTerm: Term, context?: ToolContext): Promise<ToolResult> {
    return executeToolGoal(this, goalTerm, context);
  }

  async shutdown(): Promise<void> {
    await Promise.all(Array.from(this.lifecycleState.keys()).map((name) => this.disposeTool(name)));
  }

  private emit<K extends keyof NAREventMap & string>(event: K, data: NAREventMap[K]): void {
    this.eventBus?.emit(event, data);
  }

  private emitState(name: string, state: LifecycleState): void {
    this.emit(`tool:${state === 'running' ? 'init' : state}`, { name, state });
  }

  private addToHistory(event: ToolEvent): void {
    this.executionHistory.push(event);
  }
}
