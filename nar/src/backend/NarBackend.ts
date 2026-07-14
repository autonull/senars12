import { ulid } from 'ulid';
import { randomUUID } from 'node:crypto';
import type { Backend, BackendManifest } from '@senars/core/backend';
import type { EventLog } from '@senars/core/eventlog';
import type { ConfigView } from '@senars/core/config';
import { Capability } from '@senars/core/capability';
import { createNAR, type NAR } from '../index.js';
import { DEFAULT_NAR_CONFIG } from '../../config/index.js';
import { NarConfigSchema } from '../config/NarConfigSchema.js';
import { NAR_CAPABILITIES } from './NarCapabilities.js';

export class NarBackend implements Backend {
  readonly id = 'nar';
  readonly manifest: BackendManifest = {
    id: 'nar',
    provides: NAR_CAPABILITIES,
    requires: new Set([Capability.ToolUse]),
    configSchema: NarConfigSchema,
    eventTypes: new Set([
      'belief.added', 'belief.retracted', 'belief.revised',
      'drive.changed', 'goal.achieved', 'goal.failed',
      'concept.activated', 'derivation.made',
    ]),
    handles: new Set(['input.user', 'config.set', 'tool.response']),
  };

  #nar: NAR;
  #log: EventLog;
  #pendingTools = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.#log = log;
    this.#nar = createNAR(config.get('nar') ?? DEFAULT_NAR_CONFIG);

    for await (const event of log.subscribe({
      types: [...this.manifest.handles],
    })) {
      await this.#process(event);
    }
  }

  async shutdown(): Promise<void> {
    this.#nar.stop();
  }

  async #process(event: CognitiveEvent): Promise<void> {
    switch (event.type) {
      case 'input.user': {
        if (!this.#isNarsese(event.payload.text)) break;
        const result = await this.#nar.processInput(event.payload.text);
        for (const belief of result.newBeliefs) {
          await this.#log.append({
            type: 'belief.added',
            payload: { term: belief.term.toString(), truth: belief.truth },
            correlationId: event.correlationId,
            causationId: event.id,
          });
        }
        for (const retracted of result.retractedBeliefs) {
          await this.#log.append({
            type: 'belief.retracted',
            payload: { term: retracted.term.toString() },
            correlationId: event.correlationId,
            causationId: event.id,
          });
        }
        break;
      }
      case 'config.set': {
        this.#applyConfig(event.payload.path, event.payload.value);
        break;
      }
      case 'tool.response': {
        const pending = this.#pendingTools.get(event.payload.requestId);
        if (pending) {
          if (event.payload.error) pending.reject(new Error(event.payload.error));
          else pending.resolve(event.payload.result);
          this.#pendingTools.delete(event.payload.requestId);
        }
        break;
      }
    }
  }

  #isNarsese(text: string): boolean {
    return /[<>]/.test(text) || text.includes('-->') || text.includes('<->');
  }

  #applyConfig(path: string, value: unknown): void {
    if (path.startsWith('nar.')) {
      const narPath = path.slice(4);
      this.#nar.setConfig?.(narPath, value);
    }
  }

  async requestTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const correlationId = randomUUID();
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

  getTools(): ToolDefinition[] {
    return [
      { name: 'nar-query', description: 'Query NAR beliefs', schema: { term: 'string' }, backendId: 'nar' },
      { name: 'nar-explain', description: 'Explain a belief', schema: { term: 'string' }, backendId: 'nar' },
    ];
  }
}

import type { CognitiveEvent } from '@senars/core/events';
import type { ToolDefinition } from '@senars/core/backend';