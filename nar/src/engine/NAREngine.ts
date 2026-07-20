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
import type { CognitiveEvent } from '@senars/core/cognitive-event';
import { narEventToCognitive, MAPPED_NAR_EVENTS } from '../events/bridge.js';

export type CognitiveEventEmitter = (event: CognitiveEvent) => void;

export class NAREngine extends BaseEngine {
  readonly id: EngineId = 'nar';
  readonly provides = new Set(['reasoning', 'query', 'belief-maintenance']);

  #nar: NAR;
  #emitCognitive?: CognitiveEventEmitter;

  constructor(nar?: NAR, emitCognitive?: CognitiveEventEmitter) {
    super();
    this.#nar = nar ?? new NAR(DEFAULT_CONFIG);
    this.#emitCognitive = emitCognitive;
  }

  get nar(): NAR {
    return this.#nar;
  }

  protected async doInitialize(): Promise<void> {
    if (!this.#nar.isRunning()) {
      await this.#nar.initialize();
      await this.#nar.start();
    }

    if (this.#emitCognitive) {
      this.#wireEventBridge();
    }
  }

  #wireEventBridge(): void {
    const eventBus = this.#nar.getEventBus();
    const systemEventBus = this.#nar.getSystemEventBus();
    const emitter = this.#emitCognitive;

    for (const eventKey of MAPPED_NAR_EVENTS) {
      const handler = (data: unknown) => {
        const cognitive = narEventToCognitive(eventKey, data, 'nar');
        if (cognitive && emitter) {
          emitter(cognitive);
        }
      };
      eventBus.on(eventKey as string, handler);
      systemEventBus.on(eventKey as string, handler);
    }
  }

  protected async doShutdown(): Promise<void> {
    if (this.#nar.isRunning()) {
      await this.#nar.stop();
    }
  }

  async reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]> {
    const text = stimulus.text;
    console.error('[NAREngine.reason] Input:', JSON.stringify(text), 'isNarsese:', this.#isNarsese(text));
    if (!this.#isNarsese(text)) return [];

    console.log('[NAREngine.reason] Processing Narsese...');
    // Strip tense/truth markers before parsing: "statement. :|:" or "statement. :!:"
    const clean = text.replace(/\.\s*:\|:\s*$/, '.').replace(/\.\s*:\!:\s*$/, '.');
    try {
      const timestamp = Date.now();

      if (clean.endsWith('?') || clean.endsWith('？')) {
        await this.#nar.question(clean);
        await this.#nar.run(5);
        const beliefs = this.#nar.getBeliefs();
        return beliefs.slice(-5).map((b) => ({
          term: b.term.toString(),
          truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined,
          timestamp,
        }));
      }

      if (clean.endsWith('!')) {
        await this.#nar.goal(clean);
        await this.#nar.run(3);
        return [{ term: clean, timestamp }];
      }

      await this.#nar.believe(clean);
      await this.#nar.run(3);
      const beliefs = this.#nar.getBeliefs();
      const derivations = beliefs.slice(-3).map((b) => ({
        term: b.term.toString(),
        truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined,
        timestamp,
      }));
      console.log('[NAREngine.reason] Returning derivations:', derivations.map(d => d.term));
      return derivations;
    } catch (e) {
      console.error('[NAREngine.reason] Error:', e);
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
