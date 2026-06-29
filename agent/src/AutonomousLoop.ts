import { EventEmitter } from 'node:events';
import type { NAR } from '../../nar/src';
import type { DriveManager } from '../../nar/src/drives';
import { type Logger, createLogger } from '../../nar/src/logger';
import type { TemporalEmbeddingMemory } from '../../nar/src/memory/TemporalEmbeddingMemory.js';
import { errMsg, makeId } from '../../nar/src/utils';
import type { ActionParser } from './ActionParser.js';
import type { ContextBuilder, ContextData, DriveState, ToolCall } from './ContextBuilder.js';
import type { ReflectionEngine } from './ReflectionEngine.js';
import type { WakeScheduler } from './WakeScheduler.js';
import type { Agent } from './types.js';

export type LoopState = 'idle' | 'perceiving' | 'reasoning' | 'acting' | 'reflecting' | 'sleeping';

export interface LoopConfig {
  wakeIntervalMs: number;
  maxWakeIntervalMs: number;
  minWakeIntervalMs: number;
  driveWakeThreshold: number;
}

export interface PerceptionEvent {
  source: 'startup' | 'scheduled' | 'external' | 'interrupt';
  input?: string;
  timestamp: number;
  priority?: number;
}

export interface ReasoningEvent {
  context: string;
  timestamp: number;
}

export interface ActionEvent {
  actions: ToolCall[];
  timestamp: number;
}

export interface ReflectionEvent {
  actions: ToolCall[];
  results: ToolResult[];
  timestamp: number;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  result?: unknown;
  error?: string;
  id: string;
}

export interface SystemState {
  narState: string;
  autonomyRunning: boolean;
  memoryStats: { size: number; capacity: number };
  timestamp: number;
}

export class AutonomousLoop {
  private readonly emitter = new EventEmitter();
  private state: LoopState = 'idle';
  private readonly wakeScheduler: WakeScheduler;
  private readonly agent: Agent;
  private readonly nar: NAR | undefined;
  private readonly temporalMemory: TemporalEmbeddingMemory;
  private readonly contextBuilder: ContextBuilder;
  private readonly actionParser: ActionParser;
  private readonly reflectionEngine: ReflectionEngine;
  private readonly driveManager: DriveManager;
  private readonly logger: Logger;
  private readonly config: Required<LoopConfig>;
  private recentResults: ToolResult[] = [];
  private pendingActions: ToolCall[] = [];

  constructor(
    agent: Agent,
    nar: NAR | undefined,
    temporalMemory: TemporalEmbeddingMemory,
    contextBuilder: ContextBuilder,
    actionParser: ActionParser,
    reflectionEngine: ReflectionEngine,
    wakeScheduler: WakeScheduler,
    driveManager: DriveManager,
    config: Partial<LoopConfig> = {}
  ) {
    this.agent = agent;
    this.nar = nar;
    this.temporalMemory = temporalMemory;
    this.contextBuilder = contextBuilder;
    this.actionParser = actionParser;
    this.reflectionEngine = reflectionEngine;
    this.wakeScheduler = wakeScheduler;
    this.driveManager = driveManager;
    this.logger = createLogger({ scope: 'autonomous-loop' });

    this.config = {
      wakeIntervalMs: config.wakeIntervalMs ?? 60_000,
      maxWakeIntervalMs: config.maxWakeIntervalMs ?? 300_000,
      minWakeIntervalMs: config.minWakeIntervalMs ?? 10_000,
      driveWakeThreshold: config.driveWakeThreshold ?? 0.3,
    };

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    this.logger.info('Starting AutonomousLoop');
    this.emitter.emit('perception', { source: 'startup', timestamp: Date.now() });

    this.wakeScheduler.on('wake', () => {
      this.emitter.emit('perception', { source: 'scheduled', timestamp: Date.now() });
    });

    this.wakeScheduler.start();
  }

  stop(): void {
    this.logger.info('Stopping AutonomousLoop');
    this.wakeScheduler.stop();
    this.emitter.removeAllListeners();
  }

  getState(): LoopState {
    return this.state;
  }

  getEmitter(): EventEmitter {
    return this.emitter;
  }

  async triggerPerception(input: string, priority = 0): Promise<void> {
    this.emitter.emit('perception', {
      source: 'external',
      input,
      timestamp: Date.now(),
      priority,
    });
  }

  private setupEventHandlers(): void {
    this.emitter.on('perception', async (event: unknown) => {
      const pe = event as PerceptionEvent;
      this.state = 'perceiving';
      this.logger.debug('Perception event received', { source: pe.source });

      const context = await this.buildContext(pe);
      this.emitter.emit('reasoning', { context, timestamp: Date.now() });
    });

    this.emitter.on('reasoning', async (event: unknown) => {
      const re = event as ReasoningEvent;
      this.state = 'reasoning';
      this.logger.debug('Reasoning event received');

      try {
        const response = await this.callLM(re.context);
        const actions = this.actionParser.parse(response);
        this.pendingActions = actions;
        this.emitter.emit('action', { actions, timestamp: Date.now() });
      } catch (err) {
        const errText = errMsg(err);
        this.logger.error('Reasoning failed', undefined, { error: errText });
        this.emitter.emit('reflection', {
          actions: [],
          results: [{ tool: 'llm', success: false, error: errText, id: makeId() }],
          timestamp: Date.now(),
        });
      }
    });

    this.emitter.on('action', async (event: unknown) => {
      const ae = event as ActionEvent;
      this.state = 'acting';
      this.logger.debug('Action event received', { actionCount: ae.actions.length });

      const results = await this.executeActions(ae.actions);
      this.recentResults = results;
      this.emitter.emit('reflection', { actions: ae.actions, results, timestamp: Date.now() });
    });

    this.emitter.on('reflection', async (event: unknown) => {
      const re = event as ReflectionEvent;
      this.state = 'reflecting';
      this.logger.debug('Reflection event received', { actionCount: re.actions.length });

      await this.reflect(re);
      this.scheduleNextWake();
    });
  }

  private async buildContext(event: PerceptionEvent): Promise<string> {
    const contextData: ContextData = {
      drives: this.getDriveStates(),
      memories: await this.retrieveRelevantMemories(event),
      history: await this.getRecentHistory(),
      pendingActions: this.getPendingActions(),
      systemState: this.getSystemState(),
    };

    return this.contextBuilder.build(contextData);
  }

  private async callLM(context: string): Promise<string> {
    const result = await this.agent.chat(context, { stream: false });
    return typeof result === 'string' ? result : '';
  }

  private async executeActions(actions: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const action of actions) {
      try {
        const result = await (this.agent as any).executeTool?.(action.tool, action.parameters);
        results.push({
          tool: action.tool,
          success: true,
          result,
          id: action.id,
        });
      } catch (err) {
        results.push({
          tool: action.tool,
          success: false,
          error: err instanceof Error ? err.message : String(err),
          id: action.id,
        });
      }
    }

    return results;
  }

  private async reflect(event: ReflectionEvent): Promise<void> {
    await this.reflectionEngine.reflect(event);
  }

  private scheduleNextWake(): void {
    const urgency = this.driveManager.getUrgency();
    let interval = this.config.wakeIntervalMs;

    if (urgency > this.config.driveWakeThreshold) {
      interval = Math.max(
        this.config.minWakeIntervalMs,
        this.config.wakeIntervalMs * (1 - urgency)
      );
    } else {
      interval = Math.min(
        this.config.maxWakeIntervalMs,
        this.config.wakeIntervalMs * (1 + urgency)
      );
    }

    this.wakeScheduler.scheduleWake(interval);
  }

  private getDriveStates(): DriveState[] {
    return this.driveManager.getAllStates().map((s) => ({
      name: s.spec.id,
      intensity: s.currentIntensity,
      description: s.spec.description,
      isActive: s.isActive,
    }));
  }

  private async retrieveRelevantMemories(event: PerceptionEvent): Promise<ContextData['memories']> {
    if (!event.input) return [];
    return this.temporalMemory.queryHybrid(event.input, Date.now(), 10);
  }

  private async getRecentHistory(): Promise<string> {
    const episodes = await this.agent.recall(undefined, 10);
    return episodes
      .map((e) => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.type}: ${e.content}`)
      .join('\n');
  }

  private getPendingActions(): ToolCall[] {
    return this.pendingActions;
  }

  private getSystemState(): SystemState {
    return {
      narState: this.nar?.state ?? 'unknown',
      autonomyRunning: this.state !== 'idle' && this.state !== 'sleeping',
      memoryStats: { size: 0, capacity: 0 },
      timestamp: Date.now(),
    };
  }
}

export function createAutonomousLoop(
  agent: Agent,
  nar: NAR | undefined,
  temporalMemory: TemporalEmbeddingMemory,
  contextBuilder: ContextBuilder,
  actionParser: ActionParser,
  reflectionEngine: ReflectionEngine,
  wakeScheduler: WakeScheduler,
  driveManager: DriveManager,
  config?: Partial<LoopConfig>
): AutonomousLoop {
  return new AutonomousLoop(
    agent,
    nar,
    temporalMemory,
    contextBuilder,
    actionParser,
    reflectionEngine,
    wakeScheduler,
    driveManager,
    config
  );
}
