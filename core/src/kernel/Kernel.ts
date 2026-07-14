import { ulid } from 'ulid';
import { randomUUID } from 'node:crypto';
import type { EventLog } from '../eventlog/EventLog.js';
import type { Backend, BackendManifest } from '../backend/Backend.js';
import type { ConfigView } from '../config/Config.js';
import { CapabilityRegistryImpl } from '../capability/CapabilityRegistry.js';
import { InMemoryEventLog } from '../eventlog/InMemoryEventLog.js';
import type { CognitiveEvent } from '../events/EventTypes.js';
import { validatePayload } from '../events/EventTypes.js';

export class Kernel {
  #log: EventLog;
  #backends: Map<string, Backend> = new Map();
  #registry: CapabilityRegistryImpl;
  #configViews: Map<string, ConfigView> = new Map();

  constructor(log: EventLog = new InMemoryEventLog()) {
    this.#log = log;
    this.#registry = new CapabilityRegistryImpl(log);
  }

  get log(): EventLog {
    return this.#log;
  }

  get registry(): CapabilityRegistryImpl {
    return this.#registry;
  }

  async register(backend: Backend): Promise<void> {
    await this.#log.append({
      type: 'backend.registered',
      payload: { manifest: backend.manifest },
      correlationId: randomUUID(),
    });

    const configView = new ConfigViewImpl(this.#log);
    this.#configViews.set(backend.id, configView);

    await backend.initialize(this.#log, configView);
    this.#backends.set(backend.id, backend);
  }

  getBackend(id: string): Backend | undefined {
    return this.#backends.get(id);
  }

  getBackends(): ReadonlyMap<string, Backend> {
    return this.#backends;
  }

  async start(configPath?: string): Promise<void> {
    const externalConfig = configPath ? await loadConfigFile(configPath) : {};

    for (const backend of this.#backends.values()) {
      await this.#emitConfigSchema(backend.manifest.configSchema);
      const backendConfig = externalConfig[backend.id] ?? {};
      for (const [path, value] of Object.entries(backendConfig)) {
        await this.#emitConfigSet(backend.id, path, value);
      }
    }

    await this.#emitBootstrap(externalConfig.bootstrap ?? {});

    await this.#log.append({
      type: 'kernel.ready',
      payload: { backendIds: [...this.#backends.keys()] },
      correlationId: randomUUID(),
    });
  }

  async #emitConfigSchema(schema: Record<string, unknown>): Promise<void> {
    await this.#log.append({
      type: 'config.schema',
      payload: { schema },
      correlationId: randomUUID(),
    });
  }

  async #emitConfigSet(backendId: string, path: string, value: unknown): Promise<void> {
    await this.#log.append({
      type: 'config.set',
      payload: { path: `${backendId}.${path}`, value },
      correlationId: randomUUID(),
    });
  }

  async #emitBootstrap(bootstrap: { beliefs?: string[]; atoms?: Array<{ atom: string; space?: string }>; skills?: Array<{ name: string; code: string }> }): Promise<void> {
    await this.#log.append({
      type: 'bootstrap',
      payload: bootstrap,
      correlationId: randomUUID(),
    });
  }

  async stop(): Promise<void> {
    for (const backend of this.#backends.values()) {
      await backend.shutdown?.();
    }
  }

  async submit(input: string, correlationId: string): Promise<void> {
    await this.#log.append({
      type: 'input.user',
      payload: { text: input },
      correlationId,
    });
  }
}

async function loadConfigFile(path: string): Promise<Record<string, unknown>> {
  try {
    const mod = await import(path);
    return mod.default ?? mod;
  } catch {
    return {};
  }
}

import { ConfigViewImpl } from '../config/ConfigView.js';