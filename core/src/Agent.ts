import { MemoryService } from './memory/MemoryService.js';
import { InMemoryEventLog } from './eventlog/InMemoryEventLog.js';
import type { EventLog } from './eventlog/EventLog.js';
import type { CognitiveEvent } from './CognitiveEvent.js';
import type { ChatOptions, ChatStreamEvent } from './ChatService.js';
import type { Connection } from './Transport.js';
import type { AgentCapabilities } from './Protocol.js';
import { generateId } from './helpers.js';
import type { Engine } from './engine/Engine.js';
import type { CognitiveStimulus, Context, Derivation, ToolResult } from './engine/Engine.js';
import { AgentBridge } from './AgentBridge.js';
import { PolicyEngine } from './PolicyEngine.js';
import { ToolRegistry } from './motor/ToolRegistry.js';
import { LLMCortex } from './cortex/LLMCortex.js';
import { registerBuiltinTools } from './motor/builtin-tools.js';

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export interface AgentOptions {
  log?: EventLog;
  id?: string;
  cortex?: LLMCortex;
  commandParser?: (text: string) => ParsedCommand[];
  builtinTools?: boolean;
}

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
  readonly lastCycle: number;
  readonly cycleCount: number;
  readonly errorRate: number;
}

export interface SkillDefinition {
  readonly name: string;
  readonly description?: string;
  execute(...args: unknown[]): unknown;
}

export class Agent {
  readonly id: string;
  readonly log: EventLog;
  readonly memory: MemoryService;
  readonly engines: Map<string, Engine> = new Map();
  readonly policy: PolicyEngine;
  readonly bridge: AgentBridge;
  readonly motor: ToolRegistry;
  readonly cortex?: LLMCortex;

  #cognitiveListeners = new Set<(e: CognitiveEvent) => void>();
  #transports = new Map<string, Connection>();
  #transportHandlers = new Map<string, (msg: { text: string }) => Promise<void>>();
  #skills = new Map<string, SkillDefinition>();
  #commandParser?: (text: string) => ParsedCommand[];
  #started = false;
  #cycleCount = 0;
  #lastCycleTime = 0;
  #lastResponse = '';

  constructor(opts: AgentOptions = {}) {
    this.id = opts.id ?? generateId('agent');
    this.log = opts.log ?? new InMemoryEventLog();
    this.memory = new MemoryService();
    this.policy = new PolicyEngine();
    this.bridge = new AgentBridge(this);
    this.motor = new ToolRegistry();
    this.cortex = opts.cortex;
    this.#commandParser = opts.commandParser;

    // Wire memory to log and engines
    this.memory.connectLog(this.log);
    this.memory.connectEngines(this.engines);
    this.memory.connectMotor(this.motor);

    // Register builtin tools if requested
    if (opts.builtinTools !== false) {
      registerBuiltinTools(this.motor);
    }
  }

  registerEngine(id: string, engine: Engine): void {
    this.engines.set(id, engine);
    this.memory.connectEngines(this.engines);
  }

  /** The living cognitive cycle — returns the response text */
  async cycle(stimulus: CognitiveStimulus): Promise<string> {
    this.#cycleCount++;
    this.#lastCycleTime = Date.now();
    this.#lastResponse = '';

    // 1. Perceive — append to EventLog
    this.#emitCognitive({
      type: 'input',
      engine: 'metta',
      term: stimulus.text,
      source: 'cycle',
      timestamp: Date.now(),
      correlationId: stimulus.correlationId,
    });
    const cid = await this.log.append({
      type: 'input.user',
      payload: { text: stimulus.text, source: stimulus.source },
      correlationId: stimulus.correlationId,
      causationId: '',
    });

    // 2. Recall — gather context from memory tiers
    const working = this.memory.recent(50);
    const episodic = await this.memory.queryEpisodic();
    const semantic = await this.memory.querySemantic(stimulus.text);
    const context: Context = { working, episodic, semantic };

    // 3. Reason — run engines
    const derivations: Derivation[] = [];
    for (const engine of this.engines.values()) {
      try {
        const result = await engine.reason(stimulus, context);
        derivations.push(...result);
      } catch {
        // engine unavailable, continue
      }
    }

    // 4. Narrate — synthesize via cortex if available
    let narrativeText = '';
    if (this.cortex) {
      const narrative = await this.cortex.synthesize({ stimulus, context, derivations });
      narrativeText = narrative.text;
      this.memory.append({
        type: 'narrative',
        payload: narrativeText,
        correlationId: stimulus.correlationId,
      });
    } else {
      for (const d of derivations) {
        this.memory.append({
          type: 'derivation',
          payload: d,
          correlationId: stimulus.correlationId,
        });
      }
    }

    // 5. Act — parse narrative into commands and execute
    const toolResults: Array<{ command: string; result: ToolResult }> = [];
    if (this.#commandParser && narrativeText) {
      const commands = this.#commandParser(narrativeText);
      for (const cmd of commands) {
        // 'send' is the agent's response — capture it, don't execute
        if (cmd.command === 'send') {
          this.#lastResponse = cmd.args[0] ?? '';
          continue;
        }

        // Check policy before executing
        const policyCheck = this.policy.checkCommand(cmd.command);
        if (!policyCheck.allowed) {
          const result: ToolResult = { success: false, content: null, error: policyCheck.reason ?? 'Blocked by policy' };
          toolResults.push({ command: cmd.command, result });
          continue;
        }

        const toolArgs: Record<string, unknown> = { args: cmd.args, raw: cmd.raw, command: cmd.command };
        const result = await this.motor.execute(cmd.command, toolArgs, stimulus.correlationId);
        toolResults.push({ command: cmd.command, result });
        await this.log.append({
          type: 'tool.request',
          payload: { toolName: cmd.command, args: { args: cmd.args }, timeoutMs: 30000 },
          correlationId: stimulus.correlationId,
          causationId: cid.id,
        });
        // Feed results back to engines
        for (const engine of this.engines.values()) {
          try { engine.absorb?.(result); } catch { /* ignore */ }
        }
      }
    }

    // 6. Consolidate
    await this.memory.consolidate(cid.id);
    for (const tr of toolResults) {
      this.memory.append({
        type: 'tool_result',
        payload: tr,
        correlationId: stimulus.correlationId,
      });
    }

    // 7. Project to bridge (UI)
    for (const d of derivations) {
      this.#emitCognitive({
        engine: 'nar',
        type: 'derivation',
        term: d.term,
        confidence: d.truth?.confidence ?? 1.0,
        timestamp: Date.now(),
        correlationId: stimulus.correlationId,
      });
    }
    for (const tr of toolResults) {
      this.#emitCognitive({
        engine: 'nar',
        type: 'skill:executed',
        skill: tr.command,
        result: tr.result.success ? 'success' : tr.result.error ?? 'error',
        durationMs: 0,
        timestamp: Date.now(),
        correlationId: stimulus.correlationId,
      });
    }

    return this.#lastResponse;
  }

  submit(input: string, correlationId: string): void {
    this.#emitCognitive({
      engine: 'metta',
      type: 'input',
      term: input,
      source: 'transport',
      timestamp: Date.now(),
      correlationId,
    });
  }

  mount(transport: Connection): void {
    const handler = async (message: { text: string }) => {
      const correlationId = crypto.randomUUID();
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

  registerSkill(name: string, def: { execute(...args: unknown[]): unknown }): void {
    this.#skills.set(name, { name, ...def });
  }

  capabilities(): AgentCapabilities {
    return {
      engine: 'metta',
      supports: {
        chat: true,
        beliefs: true,
        drives: false,
        skills: true,
        ltm: true,
        rlfp: false,
        selfReasoning: false,
        autonomyLoop: true,
      },
    };
  }

  health(): HealthStatus {
    return {
      status: this.#started ? 'healthy' : 'stuck',
      lastCycle: this.#lastCycleTime,
      cycleCount: this.#cycleCount,
      errorRate: 0,
    };
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    // Initialize all engines
    for (const engine of this.engines.values()) {
      try {
        if ('initialize' in engine && typeof (engine as any).initialize === 'function') {
          await (engine as any).initialize();
        }
      } catch {
        // engine init failed, continue
      }
    }
    await this.memory.load();
  }

  async stop(): Promise<void> {
    if (!this.#started) return;
    this.#started = false;
    await this.memory.persist();
    for (const transport of this.#transports.values()) {
      await transport.disconnect('agent stopping');
    }
    for (const engine of this.engines.values()) {
      try {
        if ('shutdown' in engine && typeof (engine as any).shutdown === 'function') {
          await (engine as any).shutdown();
        }
      } catch {
        // ignore
      }
    }
  }

  async *chat(input: string, _opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    const correlationId = crypto.randomUUID();
    const stimulus: CognitiveStimulus = {
      text: input,
      source: 'chat',
      timestamp: Date.now(),
      correlationId,
    };

    const response = await this.cycle(stimulus);
    if (response) {
      yield { kind: 'text-delta', text: response };
      return response;
    }

    const fallback = `[agent] ${input}`;
    yield { kind: 'text-delta', text: fallback };
    return fallback;
  }

  #emitCognitive(event: CognitiveEvent): void {
    for (const listener of this.#cognitiveListeners) {
      try { listener(event); } catch { /* ignore listener errors */ }
    }
  }
}
