import type {
  CognitiveStimulus,
  Context,
  Derivation,
  Engine,
  EngineId,
  ToolResult,
} from './Engine.js';

export abstract class BaseEngine implements Engine {
  abstract readonly id: EngineId;
  abstract readonly provides: Set<string>;
  #initialized = false;

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    await this.doInitialize();
    this.#initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.#initialized) return;
    await this.doShutdown();
    this.#initialized = false;
  }

  absorb(result: ToolResult): void {
    this.doAbsorb(result);
  }

  protected abstract doInitialize(): Promise<void>;
  protected abstract doShutdown(): Promise<void>;
  protected doAbsorb(result: ToolResult): void {}

  abstract reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
  abstract query(pattern: string): Promise<unknown[]>;
  abstract persist?(): Promise<void>;
  abstract load?(): Promise<void>;
}
