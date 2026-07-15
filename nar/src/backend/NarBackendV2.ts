import type { EventLog } from '@senars/core/eventlog';
import type { ConfigView } from '@senars/core/config';
import type { CognitiveEvent } from '@senars/core/events';
import { EventBackend } from '@senars/core/event-backend';
import type { BackendManifest, ToolDefinition } from '@senars/core/backend';
import type { ToolProvider, ToolResult } from '@senars/core/tool-provider';
import { createNAR, type NAR } from '../index.js';
import { NAR_CAPABILITIES } from './NarCapabilities.js';
import { NarConfigSchema, type NarConfig } from '../config/NarConfigSchema.js';
import { Capability as Cap } from '@senars/core/capability';

export class NarBackend extends EventBackend implements ToolProvider {
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
    handles: new Set(['input.user', 'config.set']),
  };

  #nar!: NAR;

  override async initialize(log: EventLog, config: ConfigView): Promise<void> {
    const narConfig = config.get<NarConfig>('nar') ?? {};
    this.#nar = createNAR(narConfig);
    await this.#nar.initialize();
    await this.#nar.start();
    await super.initialize(log, config);
  }

  override async shutdown(): Promise<void> {
    await this.#nar.stop();
  }

  protected override async process(event: CognitiveEvent): Promise<void> {
    switch (event.type) {
      case 'input.user': {
        const text = (event.payload as { text: string }).text;
        if (!this.#isNarsese(text)) break;
        await this.#nar.input(text);
        const beliefs = this.#nar.getBeliefs();
        for (const belief of beliefs) {
          await this.log.append({
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
    }
  }

  #applyConfig(path: string, value: unknown): void {
    if (path === 'nar.maxDerivationsPerStep') this.#nar.setConfig({ maxDerivationsPerStep: value as number });
  }

  #isNarsese(text: string): boolean {
    return /[<>]{.*}/.test(text) || text.includes('-->') || text.includes('<->');
  }

  async executeTool(name: string, args: Record<string, unknown>, _correlationId?: string): Promise<ToolResult> {
    const narResult = await this.#nar.executeTool(name, args);
    return {
      success: narResult.success,
      content: narResult.content,
      error: narResult.error,
      metadata: narResult.metadata,
    };
  }

  getTools(): ToolDefinition[] {
    return [
      { name: 'nar-query', description: 'Query NAR beliefs', schema: { term: 'string' }, backendId: 'nar' },
      { name: 'nar-explain', description: 'Explain belief evidence', schema: { term: 'string' }, backendId: 'nar' },
    ];
  }
}
