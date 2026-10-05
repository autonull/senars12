import {
  type EgressVerdict,
  type EpisodicMemory,
  generateId,
  incrementCount,
  type LMTask,
  makeId,
  mapToRecord,
} from '@senars/util';
import { ApprovalService } from './ApprovalService.js';
import { type CycleHost, runCycle, runCycleStream } from './agent/phases.js';
import type { MacroPhase } from './agent/pipeline.js';
import type {
  AgentOptions,
  CorrelationScopeStore,
  HealthStatus,
  ParsedCommand,
  SkillDefinition,
} from './agent/types.js';
import type { ChatOptions, ChatStreamEvent } from './chat.js';
import type { LLMCortex } from './cortex/LLMCortex.js';
import type { CognitiveStimulus, Derivation, Engine } from './engine/Engine.js';
import type { EventLog } from './eventlog/EventLog.js';
import { InMemoryEventLog } from './eventlog/InMemoryEventLog.js';
import { MemoryService } from './memory/MemoryService.js';
import { type PersistableSessionManager, RECALL_WINDOW } from './memory/types.js';
import { registerBuiltinTools } from './motor/builtin-tools.js';
import { ToolRegistry } from './motor/ToolRegistry.js';
import { PolicyEngine } from './PolicyEngine.js';
import type { AgentCapabilities } from './protocol/index.js';
import { type CognitiveEvent, mintCognitiveEvent } from './schemas/index.js';
import type { Connection } from './Transport.js';

export type {
  AgentOptions,
  HealthStatus,
  ParsedCommand,
  ResolvedAgentOptions,
  SkillDefinition,
} from './agent/types.js';

export class Agent {
  readonly id: string;
  readonly log: EventLog;
  readonly memory: MemoryService;
  readonly engines: Map<string, Engine> = new Map();
  readonly policy: PolicyEngine;
  readonly motor: ToolRegistry;
  readonly approval: ApprovalService;
  readonly cortex?: LLMCortex;
  readonly episodicMemory?: EpisodicMemory;
  readonly sessionManager?: PersistableSessionManager;
  readonly threadScope?: CorrelationScopeStore;

  #cognitiveListeners = new Set<(e: CognitiveEvent) => void>();
  #transports = new Map<string, Connection>();
  #transportHandlers = new Map<string, (msg: { text: string }) => Promise<void>>();
  #skills = new Map<string, SkillDefinition>();
  #commandParser?: (text: string) => ParsedCommand[];
  #groundednessGate?: (
    narration: string,
    correlationId: string
  ) => Promise<boolean | { grounded: boolean; score?: number }>;
  #traceGrader?: (trace: {
    narration: string;
    toolCalls: readonly { command: string; success: boolean }[];
    correlationId: string;
    egress?: EgressVerdict;
  }) => Promise<unknown>;
  #narrateTier?: LMTask;
  #macroPipeline?: MacroPhase[];
  #consolidateLearning?: (options: { budget?: number }) => Promise<void>;
  #consolidation?: { enabled?: boolean; budget?: number };
  #started = false;
  #cycleCount = 0;
  #engineErrors = new Map<string, number>();
  #engineErrorCount = 0;
  #lastCycleTime = 0;
  #lastResponse = '';

  constructor(opts: AgentOptions = {}) {
    this.id = opts.id ?? generateId('agent');
    this.log = opts.log ?? new InMemoryEventLog();
    this.memory = new MemoryService();
    this.policy = new PolicyEngine();
    this.motor = new ToolRegistry(opts.feedbackObserver);
    this.cortex = opts.cortex;
    this.episodicMemory = opts.episodicMemory;
    this.sessionManager = opts.sessionManager;
    this.#commandParser = opts.commandParser;
    this.#groundednessGate = opts.groundednessGate;
    this.#traceGrader = opts.traceGrader;
    this.#narrateTier = opts.narrateTier;
    this.#macroPipeline = opts.macroPipeline;
    this.#consolidateLearning = opts.consolidateLearning;
    this.#consolidation = opts.consolidation;
    this.threadScope = opts.threadScope;

    this.memory.connectLog(this.log);
    this.memory.connectEngines(this.engines);
    this.memory.connectMotor(this.motor);

    const approvalService = new ApprovalService();
    this.approval = approvalService;

    if (opts.builtinTools !== false) {
      registerBuiltinTools(this.motor, approvalService, {
        episodic: this.episodicMemory,
        metta: opts.mettaExecutor,
        pins: opts.pinStore,
      });
    }
  }

  registerEngine(id: string, engine: Engine): void {
    this.engines.set(id, engine);
    this.memory.connectEngines(this.engines);
  }

  async cycle(stimulus: CognitiveStimulus): Promise<string> {
    this.#cycleCount++;
    this.#lastCycleTime = Date.now();
    return runCycle(this.#cycleHost(), stimulus);
  }

  submit(input: string, correlationId: string): void {
    this.#emitCognitive(
      mintCognitiveEvent('input.user', {
        engine: 'nar',
        correlationId,
        payload: { text: input, source: 'transport' },
      })
    );
  }

  mount(transport: Connection): void {
    const handler = async (message: { text: string }) => {
      const correlationId = makeId();
      this.submit(message.text, correlationId);
    };
    transport.onMessage(handler);
    this.#transportHandlers.set(transport.id, handler);
    this.#transports.set(transport.id, transport);
  }

  unmount(idOrTransport: string | Connection): void {
    const id = typeof idOrTransport === 'string' ? idOrTransport : idOrTransport.id;
    const transport = this.#transports.get(id);
    if (!transport) return;
    const handler = this.#transportHandlers.get(id);
    if (handler) {
      transport.removeMessageHandler(handler);
      this.#transportHandlers.delete(id);
    }
    this.#transports.delete(id);
  }

  on(_event: string | '*', handler: (e: CognitiveEvent) => void): void {
    this.#cognitiveListeners.add(handler);
  }

  off(_event: string | '*', handler: (e: CognitiveEvent) => void): void {
    this.#cognitiveListeners.delete(handler);
  }

  emitCognitive(event: CognitiveEvent): void {
    this.#emitCognitive(event);
  }

  registerSkill(name: string, def: { execute(...args: unknown[]): unknown }): void {
    this.#skills.set(name, { name, ...def });
  }

  capabilities(): AgentCapabilities {
    return {
      engine: 'nar',
      supports: {
        chat: true,
        beliefs: true,
        drives: false,
        skills: true,
        ltm: true,
        rlfp: false,
        selfReasoning: false,
        autonomyLoop: false,
      },
    };
  }

  health(): HealthStatus {
    const byEngine = mapToRecord(this.#engineErrors);
    return {
      status: this.#started ? 'healthy' : 'stuck',
      lastCycle: this.#lastCycleTime,
      cycleCount: this.#cycleCount,
      errorRate: this.#cycleCount ? this.#engineErrorCount / this.#cycleCount : 0,
      byEngine,
    };
  }

  /** Per-engine fault tally for `health()`; a cycle with no faults reports zero. */
  onEngineError(engineId: string): void {
    this.#engineErrorCount++;
    incrementCount(this.#engineErrors, engineId);
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    for (const engine of this.engines.values()) {
      try {
        if ('initialize' in engine && typeof engine.initialize === 'function') {
          await engine.initialize();
        }
      } catch {
        // engine init failed, continue
      }
    }
    await this.memory.load();
    await this.sessionManager?.restore();
  }

  async stop(): Promise<void> {
    if (!this.#started) return;
    this.#started = false;
    await this.sessionManager?.snapshot();
    await this.memory.persist();
    for (const [id, transport] of this.#transports) {
      this.unmount(id);
      await transport.disconnect('agent stopping');
    }
    for (const engine of this.engines.values()) {
      try {
        if ('shutdown' in engine && typeof engine.shutdown === 'function') {
          await engine.shutdown();
        }
      } catch {
        // ignore
      }
    }
  }

  async *chat(input: string, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    const correlationId = makeId();
    const stimulus: CognitiveStimulus = {
      text: input,
      source: 'chat',
      timestamp: Date.now(),
      correlationId,
    };
    if (opts?.signal?.aborted) {
      yield { kind: 'aborted' };
      return '';
    }

    let finalText = '';
    for await (const evt of runCycleStream(this.#cycleHost(), stimulus, opts)) {
      if (evt.kind === 'text-delta' && evt.text) finalText += evt.text;
      yield evt;
    }
    if (!finalText) {
      finalText = `[agent] ${input}`;
      yield { kind: 'text-delta', text: finalText };
    }
    yield { kind: 'finish', text: finalText };
    return finalText;
  }

  getRecentDerivations(): Derivation[] {
    return this.memory
      .recent(RECALL_WINDOW)
      .filter((e) => e.type === 'derivation')
      .map((e) => e.payload as Derivation);
  }

  #cycleHost(): CycleHost {
    return {
      log: this.log,
      memory: this.memory,
      engines: this.engines,
      policy: this.policy,
      motor: this.motor,
      cortex: this.cortex,
      episodicMemory: this.episodicMemory,
      commandParser: this.#commandParser,
      groundednessGate: this.#groundednessGate,
      traceGrader: this.#traceGrader,
      narrateTier: this.#narrateTier,
      macroPipeline: this.#macroPipeline,
      consolidateLearning: this.#consolidateLearning,
      consolidation: this.#consolidation,
      threadScope: this.threadScope,
      emit: (e) => this.#emitCognitive(e),
      onEngineError: (engineId) => this.onEngineError(engineId),
      getLastResponse: () => this.#lastResponse,
      setLastResponse: (v) => {
        this.#lastResponse = v;
      },
    };
  }

  #emitCognitive(event: CognitiveEvent): void {
    for (const listener of this.#cognitiveListeners) {
      try {
        listener(event);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  /** Phase A (REFACTOR.todo1): install a custom macro pipeline (e.g. dialogue Capture phase). */
  setMacroPipeline(phases: MacroPhase[]): void {
    this.#macroPipeline = phases;
  }
}
