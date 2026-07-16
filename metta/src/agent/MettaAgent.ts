import { Agent, type AgentOptions } from '@senars/core';
import type { AgentCapabilities, ChatOptions, ChatStreamEvent, CognitiveEvent, Connection, HealthStatus } from '@senars/core';
import type { MeTTaAtom } from '../types/ast.js';
import type { MettaAgentOptions, MettaLoopConfig, SkillFeedback } from './MettaTypes.js';
import { DEFAULT_LOOP_CONFIG } from './MettaTypes.js';

export class MettaAgent {
  readonly #agent: Agent;

  constructor(opts: MettaAgentOptions = {}) {
    const coreOpts: AgentOptions = {};
    if (opts.loopConfig) coreOpts.id = `metta-${Date.now()}`;
    this.#agent = new Agent(coreOpts);
  }

  get state(): 'idle' | 'running' | 'stopped' {
    const h = this.#agent.health();
    return h.status === 'healthy' ? 'running' : 'idle';
  }

  start(): void {
    this.#agent.start();
  }

  stop(): void {
    this.#agent.stop();
  }

  submit(input: string, correlationId: string): void {
    this.#agent.submit(input, correlationId);
  }

  mount(transport: Connection): void {
    this.#agent.mount(transport);
  }

  unmount(transport: Connection): void {
    this.#agent.unmount(transport);
  }

  on(event: string | '*', handler: (event: CognitiveEvent) => void): void {
    this.#agent.on(event, handler);
  }

  off(event: string | '*', handler: (event: CognitiveEvent) => void): void {
    this.#agent.off(event, handler);
  }

  capabilities(): AgentCapabilities {
    return this.#agent.capabilities();
  }

  health(): HealthStatus {
    return this.#agent.health();
  }

  registerSkill(name: string, op: { execute(...args: unknown[]): unknown }): void {
    this.#agent.registerSkill(name, op);
  }

  async *chat(input: string, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    const result = yield* this.#agent.chat(input, opts);
    return result;
  }

  async learn(_atom: string, _spaceId?: string): Promise<void> {
    // delegated to MemoryService in future
  }

  async recall(_pattern: string, _limit?: number, _spaceId?: string): Promise<MeTTaAtom[]> {
    return [];
  }

  getAllSkillFeedback(): SkillFeedback[] {
    return [];
  }

  configureLoop(_config: Partial<MettaLoopConfig>): void {
    // no-op in thin constructor
  }

  get core(): Agent {
    return this.#agent;
  }
}
