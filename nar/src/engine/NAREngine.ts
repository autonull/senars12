import type {
  CognitiveStimulus,
  Context,
  Derivation,
  EngineId,
  ToolResult,
} from '@senars/core/engine';
import { BaseEngine } from '@senars/core/engine/base';
import { NAR } from '../nar.js';
import { DEFAULT_CONFIG } from '../types/index.js';

export class NAREngine extends BaseEngine {
  readonly id: EngineId = 'nar';
  readonly provides = new Set(['reasoning', 'query', 'belief-maintenance']);

  #nar: NAR;

  constructor(nar?: NAR) {
    super();
    this.#nar = nar ?? new NAR(DEFAULT_CONFIG);
  }

  get nar(): NAR {
    return this.#nar;
  }

  protected async doInitialize(): Promise<void> {
    if (!this.#nar.isRunning()) {
      await this.#nar.initialize();
      await this.#nar.start();
    }
  }

  protected async doShutdown(): Promise<void> {
    if (this.#nar.isRunning()) {
      await this.#nar.stop();
    }
  }

  async reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]> {
    const text = stimulus.text;
    if (!this.#isNarsese(text)) return [];

    try {
      const timestamp = Date.now();

      if (text.endsWith('?') || text.endsWith('？')) {
        await this.#nar.question(text);
        await this.#nar.run(5);
        const beliefs = this.#nar.getBeliefs();
        return beliefs.slice(-5).map((b) => ({
          term: b.term.toString(),
          truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined,
          timestamp,
        }));
      }

      if (text.endsWith('!')) {
        await this.#nar.goal(text);
        await this.#nar.run(3);
        return [{ term: text, timestamp }];
      }

      await this.#nar.believe(text);
      await this.#nar.run(3);
      const beliefs = this.#nar.getBeliefs();
      return beliefs.slice(-3).map((b) => ({
        term: b.term.toString(),
        truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined,
        timestamp,
      }));
    } catch {
      return [];
    }
  }

  async query(pattern: string): Promise<unknown[]> {
    const beliefs = this.#nar.getBeliefs();
    const lower = pattern.toLowerCase();
    return beliefs.filter((b) => b.term.toString().toLowerCase().includes(lower));
  }

  protected override doAbsorb(result: ToolResult): void {
    // NAR can learn from tool results in future
  }

  async persist(): Promise<void> {
    // Delegated to NAR's internal persistence
  }

  async load(): Promise<void> {
    // Delegated to NAR's internal persistence
  }

  #isNarsese(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    if (
      trimmed.startsWith('(') ||
      trimmed.startsWith('<') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('[')
    )
      return true;
    if (
      trimmed.includes('-->') ||
      trimmed.includes('<->') ||
      trimmed.includes('==>') ||
      trimmed.includes('<=>')
    )
      return true;
    if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
      const body = trimmed.slice(0, -1).trim();
      if (body.startsWith('(') || body.startsWith('<')) return true;
    }
    return false;
  }
}
