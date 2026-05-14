import type {
  Tool,
  ToolCapabilities,
  ToolChainResult,
  ToolChainStep,
  ToolContext,
  ToolEvent,
  ToolFilter,
  ToolResult,
  ToolStatistics
} from './types';
import {Registry} from './registry';
import {EventEmitter} from 'events';

export interface ToolDescriptor {
  name: string;
  description: string;
  capabilities?: ToolCapabilities;
  tags?: string[];
  version?: string;
}

type LifecycleState = 'initialized' | 'running' | 'stopped' | 'disposed';

export class ToolManager extends EventEmitter {
  private readonly registry = new Registry();
  private readonly executionHistory: ToolEvent[] = [];
  private readonly statistics = new Map<string, ToolStatistics>();
  private readonly allowedPermissions = new Set<string>();
  private readonly toolDescriptors = new Map<string, ToolDescriptor>();
  private readonly lifecycleState = new Map<string, LifecycleState>();
  private readonly maxHistory = 100;
  private readonly sandboxMode: boolean;

  constructor(options?: {sandboxMode?: boolean; allowedPermissions?: string[]}) {
    super();
    this.sandboxMode = options?.sandboxMode ?? false;
    options?.allowedPermissions?.forEach(p => this.allowedPermissions.add(p));
  }

  register(tool: Tool, descriptor?: ToolDescriptor): void {
    this.registry.register(tool);
    this.lifecycleState.set(tool.name, 'initialized');
    this.toolDescriptors.set(tool.name, descriptor ?? {
      name: tool.name,
      description: tool.description,
      capabilities: tool.capabilities,
      tags: [],
      version: '1.0.0'
    });
    this.emit('tool:register', {name: tool.name, descriptor: this.toolDescriptors.get(tool.name)});
  }

  unregister(name: string): void {
    this.stopTool(name);
    this.registry.unregister(name);
    this.statistics.delete(name);
    this.lifecycleState.delete(name);
    this.toolDescriptors.delete(name);
    this.emit('tool:unregister', {name});
  }

  async initializeTool(name: string): Promise<boolean> {
    const tool = this.get(name);
    const state = this.lifecycleState.get(name);
    if (!tool || state === 'running' || state === 'disposed') return false;

    try {
      if (tool.capabilities?.requiresPermissions &&
          !tool.capabilities.requiresPermissions.every(p => this.allowedPermissions.has(p))) {
        return false;
      }
      this.lifecycleState.set(name, 'running');
      this.emit('tool:init', {name, state: 'running'});
      return true;
    } catch (error) {
      console.warn(`Tool initialization failed for ${name}:`, error);
      return false;
    }
  }

  async stopTool(name: string): Promise<boolean> {
    if (this.lifecycleState.get(name) !== 'running') return false;
    try {
      this.lifecycleState.set(name, 'stopped');
      this.emit('tool:stop', {name, state: 'stopped'});
      return true;
    } catch (error) {
      console.warn(`Tool stop failed for ${name}:`, error);
      return false;
    }
  }

  async disposeTool(name: string): Promise<boolean> {
    if (this.lifecycleState.get(name) === 'disposed') return true;
    try {
      this.lifecycleState.set(name, 'disposed');
      this.emit('tool:dispose', {name, state: 'disposed'});
      return true;
    } catch (error) {
      console.warn(`Tool disposal failed for ${name}:`, error);
      return false;
    }
  }

  getToolDescriptor(name: string): ToolDescriptor | undefined {
    return this.toolDescriptors.get(name);
  }

  discoverTools(filter?: {tags?: string[]; capabilities?: string[]}): ToolDescriptor[] {
    const all = Array.from(this.toolDescriptors.values());
    if (!filter) return all;

    return all.filter(desc => {
      if (filter.tags && !filter.tags.every(tag => this.toolDescriptors.get(desc.name)?.tags?.includes(tag))) {
        return false;
      }
      if (filter.capabilities) {
        const caps = desc.capabilities;
        if (!caps) return false;
        if (filter.capabilities.includes('pure') && !caps.pure) return false;
        if (filter.capabilities.includes('readOnly') && !caps.readOnly) return false;
      }
      return true;
    });
  }

  resolveConflict(tools: string[], context?: {preference?: 'first' | 'best' | 'random'}): string | null {
    if (tools.length <= 1) return tools[0] ?? null;
    const preference = context?.preference || 'first';

    if (preference === 'best') {
      let best: string | null = null;
      let bestScore = -1;
      for (const name of tools) {
        const stats = this.getStatistics(name);
        const score = stats?.successfulCalls ? stats.successfulCalls / stats.totalCalls : 0;
        if (score > bestScore) {
          bestScore = score;
          best = name;
        }
      }
      return best || tools[0]!;
    }

    if (preference === 'random') {
      return tools[Math.floor(Math.random() * tools.length)]!;
    }

    return tools[0]!;
  }

  get(name: string): Tool | undefined {
    return this.registry.get(name);
  }

  list(filter?: ToolFilter): Tool[] {
    const all = this.registry.list();
    if (!filter) return all;

    return all.filter(tool => {
      if (filter.tags && !filter.tags.every(tag => tool.tags?.includes(tag))) return false;
      if (filter.readOnly && tool.capabilities?.readOnly !== true) return false;
      return true;
    });
  }

  async execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const tool = this.get(name);
    if (!tool) return {success: false, content: null, error: `Tool '${name}' not found`};

    const state = this.lifecycleState.get(name);
    if (state !== 'running' && state !== 'initialized') {
      return {success: false, content: null, error: `Tool '${name}' is not running (state: ${state})`};
    }

    if (this.sandboxMode && context?.permissions) {
      const required = tool.capabilities?.requiresPermissions || [];
      if (!required.every(p => context.permissions?.has(p))) {
        return {success: false, content: null, error: `Missing required permissions: ${required.join(', ')}`};
      }
    }

    const budget = context?.budget;
    if (budget) {
      budget.executions = (budget.executions || 0) + 1;
      if (budget.maxExecutions && budget.executions > budget.maxExecutions) {
        return {success: false, content: null, error: 'Execution budget exceeded'};
      }
    }

    const event: ToolEvent = {type: 'tool_call', name, args, timestamp: startTime, context};
    this.emit('tool:call', event);
    this.addToHistory(event);

    try {
      const result = await this.registry.execute(name, args, context);
      const duration = Date.now() - startTime;
      const resultEvent: ToolEvent = {type: 'tool_result', name, args, result, timestamp: Date.now(), duration, context};

      this.updateStatistics(name, result, duration);
      this.emit('tool:result', resultEvent);
      this.addToHistory(resultEvent);

      if (budget) {
        budget.totalDuration = (budget.totalDuration || 0) + duration;
        if (budget.maxTotalDuration && budget.totalDuration > budget.maxTotalDuration) {
          result.error = 'Duration budget exceeded';
          result.success = false;
        }
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorEvent: ToolEvent = {
        type: 'tool_error',
        name,
        args,
        result: {success: false, content: null, error: error instanceof Error ? error.message : 'Unknown error'},
        timestamp: Date.now(),
        duration,
        context
      };

      this.updateStatistics(name, {success: false, content: null, error: String(error)}, duration);
      this.emit('tool:error', errorEvent);
      this.addToHistory(errorEvent);
      throw error;
    }
  }

  executeChain = (chain: ToolChainStep[]): Promise<ToolChainResult> =>
    this.registry.executeChain(chain);

  getStatistics(name: string): ToolStatistics | undefined {
    return this.statistics.get(name);
  }

  getAllStatistics(): Map<string, ToolStatistics> {
    return new Map(this.statistics);
  }

  resetStatistics(name?: string): void {
    if (name) {
      this.statistics.delete(name);
      this.initializeStatistics(name);
    } else {
      this.statistics.clear();
    }
  }

  getHistory(limit = 10): ToolEvent[] {
    return this.executionHistory.slice(-limit);
  }

  clearHistory(): void {
    this.executionHistory = [];
  }

  async shutdown(): Promise<void> {
    await Promise.all(Array.from(this.lifecycleState.keys()).map(name => this.disposeTool(name)));
  }

  private initializeStatistics(name: string): void {
    if (!this.statistics.has(name)) {
      this.statistics.set(name, {
        name,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalDuration: 0,
        averageDuration: 0
      });
    }
  }

  private updateStatistics(name: string, result: ToolResult, duration: number): void {
    const stats = this.statistics.get(name);
    if (!stats) return;

    stats.totalCalls++;
    stats.successfulCalls += result.success ? 1 : 0;
    stats.failedCalls += result.success ? 0 : 1;
    stats.totalDuration += duration;
    stats.averageDuration = stats.totalDuration / stats.totalCalls;
    stats.lastCalled = Date.now();
  }

  private addToHistory(event: ToolEvent): void {
    this.executionHistory.push(event);
    if (this.executionHistory.length > this.maxHistory) {
      this.executionHistory.shift();
    }
  }
}
