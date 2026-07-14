import { ulid } from 'ulid';
import type { EventLog } from '@senars/core/eventlog';
import type { ConfigView } from '@senars/core/config';
import type { Backend, BackendManifest } from '@senars/core/backend';
import type { Capability } from '@senars/core/capability';
import { createNAR, type NAR } from '../index.js';
import { NAR_CAPABILITIES } from './NarCapabilities.js';
import { NarConfigSchema, type NarConfig } from '../config/NarConfigSchema.js';
import { Capability as Cap } from '@senars/core/capability';

export class NarBackend implements Backend {
  readonly id = 'nar';
  readonly manifest: BackendManifest = {
    id: 'nar',
    provides: NAR_CAPABILITIES,
    requires: new Set([Cap.ToolUse]),
    configSchema: NarConfigSchema.shape,
    eventTypes: new Set([
      'belief.added', 'belief.retracted', 'belief.revised',
      'drive.changed', 'goal.achieved', 'goal.failed',
      'concept.activated', 'derivation.made',
    ]),
    handles: new Set(['input.user', 'config.set', 'tool.response']),
  };

  #nar!: NAR;
  #log!: EventLog;
  #pendingTools = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.#log = log;
    const narConfig = config.get<NarConfig>('nar') ?? {};
    this.#nar = createNAR(narConfig);
    await this.#nar.initialize();
    await this.#nar.start();

    // Run event processing in background
    this.#processEvents();
  }

  #processEvents(): void {
    (async () => {
      for await (const event of this.#log.subscribe({ types: [...this.manifest.handles] })) {
        await this.#process(event);
      }
    })();
  }

  async shutdown(): Promise<void> {
    await this.#nar.stop();
  }

  async #process(event: { type: string; payload: unknown; correlationId: string; id: string }): Promise<void> {
    switch (event.type) {
      case 'input.user': {
        const text = (event.payload as { text: string }).text;
        if (!this.#isNarsese(text)) break;
        await this.#nar.input(text);
        const beliefs = this.#nar.getBeliefs();
        for (const belief of beliefs) {
          await this.#log.append({
            type: 'belief.added',
            payload: { term: belief.term.toString(), truth: { frequency: belief.truth.f, confidence: belief.truth.c } },
            correlationId: event.correlationId,
            causationId: event.id,
          });
        }
        break;
      }
      case 'config.set': {
        const { path, value } = event.payload as { path: string; value: unknown };
        this.#applyConfig(path, value);
        break;
      }
      case 'tool.response': {
        const { requestId, error, result } = event.payload as { requestId: string; error?: string; result?: unknown };
        const pending = this.#pendingTools.get(requestId);
        if (pending) {
          if (error) pending.reject(new Error(error));
          else pending.resolve(result);
          this.#pendingTools.delete(requestId);
        }
        break;
      }
    }
  }

#applyConfig(path: string, value: unknown): void {
    if (path === 'nar.maxDerivationsPerStep') this.#nar.setConfig({ maxDerivationsPerStep: value as number });
  }

  #isNarsese(text: string): boolean {
    return /[<>]{.*}/.test(text) || text.includes('-->') || text.includes('<->');
  }

  async requestTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const correlationId = ulid();
    const promise = new Promise<unknown>((resolve, reject) => {
      this.#pendingTools.set(correlationId, { resolve, reject });
    });
    await this.#log.append({
      type: 'tool.request',
      payload: { toolName, args, timeoutMs: 30000 },
      correlationId,
    });
    return promise;
  }

  getTools(): Array<{ name: string; description: string; schema: Record<string, unknown>; backendId: string }> {
    return [
      { name: 'nar-query', description: 'Query NAR beliefs', schema: { term: 'string' }, backendId: 'nar' },
      { name: 'nar-explain', description: 'Explain belief evidence', schema: { term: 'string' }, backendId: 'nar' },
    ];
  }
}