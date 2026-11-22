import type {
  CognitiveStimulus,
  Context,
  Derivation,
  EngineId,
  ToolResult,
} from '@senars/types';
import { BaseEngine } from './BaseEngine';
import type { CognitiveEvent } from '@senars/schemas';
import { asBeliefTruth } from '@senars/types/truth';
import { createLogger } from '@senars/util/logger';
import { DisposalRegistry } from '@senars/util/disposal';
import { errMsg } from '@senars/util/error';
import { takeLast } from '@senars/util/collections';
import { MAPPED_NAR_EVENTS, narEventToCognitive } from '../events/bridge';
import { filterByTerm } from '../memory/term-filter';
import { NAR } from '../nar';
import { dispatchNarseseIntent } from '../nl/narsese-intent';
import { DEFAULT_CONFIG } from '../types/index';

export type CognitiveEventEmitter = (event: CognitiveEvent) => void;

const logger = createLogger({ scope: 'nar-engine', level: 'debug' });

export class NAREngine extends BaseEngine {
  readonly id: EngineId = 'nar';
  readonly provides = new Set(['reasoning', 'query', 'belief-maintenance']);

  #nar: NAR;
  #emitCognitive?: CognitiveEventEmitter;
  /** Present exactly while the bridge is wired — its absence is the idempotency guard. */
  #unwire?: DisposalRegistry;

  constructor(nar?: NAR, emitCognitive?: CognitiveEventEmitter) {
    super();
    this.#nar = nar ?? new NAR(DEFAULT_CONFIG);
    this.#emitCognitive = emitCognitive;
  }

  get nar(): NAR {
    return this.#nar;
  }

  async reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]> {
    // One router for the whole repo: Narsese of which kind, or prose.
    const intent = dispatchNarseseIntent(stimulus.text);
    if (!intent) return [];

    const clean = intent.text;
    const correlationId = stimulus.correlationId;
    try {
      const timestamp = Date.now();

      if (intent.kind === 'question') {
        await this.#nar.question(clean, correlationId);
        await this.#nar.run(5, undefined, correlationId);
        const beliefs = this.#nar.getBeliefs();
        return takeLast(beliefs, 5).map((b) => ({
          term: b.term.toString(),
          truth: asBeliefTruth(b.truth),
          timestamp,
        }));
      }

      if (intent.kind === 'goal') {
        await this.#nar.goal(clean, undefined, correlationId);
        await this.#nar.run(3, undefined, correlationId);
        return [{ term: clean, timestamp }];
      }

      await this.#nar.believe(clean, undefined, correlationId);
      await this.#nar.run(3, undefined, correlationId);
      const beliefs = this.#nar.getBeliefs();
      const derivations = takeLast(beliefs, 3).map((b) => ({
        term: b.term.toString(),
        truth: asBeliefTruth(b.truth),
        timestamp,
      }));
      logger.debug('derivations', { terms: derivations.map((d) => d.term) });
      return derivations;
    } catch (e) {
      logger.warn('reason failed', { error: errMsg(e) });
      return [];
    }
  }

  async query(pattern: string): Promise<unknown[]> {
    return filterByTerm(this.#nar.getBeliefs(), pattern);
  }

  async persist(): Promise<void> {
    // Delegated to NAR's internal persistence
  }

  async load(): Promise<void> {
    // Delegated to NAR's internal persistence
  }

  protected async doInitialize(): Promise<void> {
    if (this.#nar.getState() !== 'running') {
      await this.#nar.initialize();
      await this.#nar.start();
    }

    if (this.#emitCognitive) {
      this.#wireEventBridge();
    }
  }

  protected async doShutdown(): Promise<void> {
    await this.#unwireEventBridge();
    if (this.#nar.isRunning()) {
      await this.#nar.stop();
    }
  }

  protected override doAbsorb(result: ToolResult): void {
    // NAR can learn from tool results in future
  }

  /**
   * `initialize` is idempotent on the NAR but not on this bridge, so a second
   * call would double every subscriber and emit each event twice. Wiring is
   * therefore a paired unbind rather than a bare registration loop.
   */
  #wireEventBridge(): void {
    if (this.#unwire) return;
    const unwire = new DisposalRegistry();
    this.#unwire = unwire;
    const eventBus = this.#nar.getEventBus();
    const emitter = this.#emitCognitive;

    for (const eventKey of MAPPED_NAR_EVENTS) {
      const handler = (data: unknown) => {
        const cognitive = narEventToCognitive(eventKey, data);
        if (cognitive && emitter) emitter(cognitive);
      };
      eventBus.on(eventKey as string, handler);
      unwire.add(() => eventBus.off(eventKey as string, handler));
    }
  }

  async #unwireEventBridge(): Promise<void> {
    await this.#unwire?.disposeAll();
    this.#unwire = undefined;
  }
}
