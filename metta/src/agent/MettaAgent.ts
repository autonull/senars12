import type { CognitiveEvent, AgentCapabilities, Connection } from '@senars/core';
import { createMeTTa, type MeTTaRuntime } from '../runtime/builder.js';
import { parseMeTTa } from '../parser/runtime.js';
import { InMemorySpace } from '../core/space.js';
import type { MettaAgentOptions, MettaLoopConfig, HealthStatus, MettaAgent as MettaAgentInterface, SkillFeedback } from './MettaTypes.js';
import { DEFAULT_LOOP_CONFIG } from './MettaTypes.js';
import type { GroundedOp } from '../core/ops.js';
import type { MeTTaAtom } from '../types/ast.js';
import { MettaSkills } from './MettaSkills.js';
import { MettaLoop } from './MettaLoop.js';
import { MettaHistory } from './MettaHistory.js';
import { MettaPromptBuilder } from './MettaPromptBuilder.js';
import { MettaLTM } from './MettaLTM.js';
import { MettaKnowledge } from './MettaKnowledge.js';
import { PolicyEngine } from './PolicyEngine.js';

export class MettaAgent implements MettaAgentInterface {
  readonly state: 'idle' | 'running' | 'stopped' = 'idle';
  #metta: MeTTaRuntime;
  #skills: MettaSkills;
  #history: MettaHistory;
  #promptBuilder: MettaPromptBuilder;
  #ltm: MettaLTM;
  #knowledge: MettaKnowledge;
  #policy: PolicyEngine;
  #loop: MettaLoop | null = null;
  #cognitiveListeners = new Set<(event: CognitiveEvent) => void>();
  #transportCleanups = new Map<string, () => void>();
  #loopConfig: MettaLoopConfig;

  constructor(opts: MettaAgentOptions = {}) {
    this.#metta = createMeTTa();
    this.#skills = new MettaSkills();
    this.#history = new MettaHistory();
    this.#promptBuilder = new MettaPromptBuilder();
    this.#ltm = new MettaLTM();
    this.#knowledge = new MettaKnowledge();
    this.#policy = new PolicyEngine();
    this.#loopConfig = { ...DEFAULT_LOOP_CONFIG, ...opts.loopConfig };

    this.#metta.evaluate(parseMeTTa('(add-atom (state stopped))'));
    const space = new InMemorySpace('default');
    space.add(parseMeTTa('(started)'));
  }

  start(): void {
    if (this.state === 'running') return;
    (this as unknown as { state: 'idle' | 'running' | 'stopped' }).state = 'running';
    this.#loop = new MettaLoop(
      this.#metta,
      this.#skills,
      this.#history,
      this.#promptBuilder,
      (e) => this.#emitCognitive(e),
      this.#loopConfig,
    );
    this.#loop.run().catch(console.error);
  }

  stop(): void {
    (this as unknown as { state: 'idle' | 'running' | 'stopped' }).state = 'stopped';
    if (this.#loop) {
      this.#loop.stop();
    }
  }

  submit(input: string, correlationId: string): void {
    if (this.#loop) {
      this.#loop.enqueueMessage(input, correlationId);
    } else {
      this.#emitCognitive({
        engine: 'metta',
        type: 'input',
        term: input,
        source: 'transport',
        timestamp: Date.now(),
        correlationId,
      });
      this.#emitCognitive({
        engine: 'metta',
        type: 'derivation',
        term: input,
        confidence: 1.0,
        timestamp: Date.now(),
        correlationId,
      });
    }
  }

  on(_event: string | '*', handler: (event: CognitiveEvent) => void): void {
    this.#cognitiveListeners.add(handler);
  }

  off(_event: string | '*', handler: (event: CognitiveEvent) => void): void {
    this.#cognitiveListeners.delete(handler);
  }

  health(): HealthStatus {
    const cycleCount = this.#loop?.config.maxWakeLoops ?? 0;
    return {
      status: this.state === 'running' ? 'healthy' : 'stuck',
      lastCycle: Date.now(),
      cycleCount,
      errorRate: 0,
    };
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

  mount(transport: Connection): void {
    const handler = async (message: { text: string }) => {
      const correlationId = crypto.randomUUID();
      this.submit(message.text, correlationId);
    };
    transport.onMessage(handler as (msg: unknown) => Promise<void>);
    this.#transportCleanups.set(transport.id, () => {
      transport.removeMessageHandler(handler as (msg: unknown) => Promise<void>);
    });
  }

  unmount(transport: Connection): void {
    const cleanup = this.#transportCleanups.get(transport.id);
    if (cleanup) {
      cleanup();
      this.#transportCleanups.delete(transport.id);
    }
  }

  registerSkill(name: string, op: GroundedOp): void {
    this.#skills.register(name, op);
  }

  async learn(atom: string, spaceId?: string): Promise<void> {
    await this.#ltm.store(atom, spaceId);
  }

  async recall(pattern: string, limit = 20, spaceId?: string): Promise<MeTTaAtom[]> {
    return this.#ltm.recall(pattern, limit, spaceId);
  }

  async importKnowledgePriors(dir: string, spaceId?: string): Promise<string> {
    return this.#knowledge.importKnowledgePriors(dir, spaceId);
  }

  configureLoop(config: Partial<MettaLoopConfig>): void {
    this.#loopConfig = { ...this.#loopConfig, ...config };
    if (this.#loop) {
      this.#loop.configure(this.#loopConfig);
    }
  }

  #emitCognitive(event: CognitiveEvent): void {
    for (const listener of this.#cognitiveListeners) {
      try {
        listener(event);
      } catch {
        // ignore listener errors
      }
    }
  }

  getAllSkillFeedback(): SkillFeedback[] {
    return this.#skills.getAllFeedback();
  }

  getSkillsRecentResults(limit: number): string {
    return this.#skills.getRecentResults(limit);
  }

  sendMessage(_target: string): string {
    return 'sent';
  }

  getEpisodesByTime(timeStr: string, contextLines = 20): Promise<string> {
    return Promise.resolve(this.#history.toPromptLines(contextLines));
  }
}
