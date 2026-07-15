import { randomUUID } from 'node:crypto';
import type { EventLog } from '../eventlog/EventLog.js';
import type { Backend, BackendManifest, ToolDefinition } from '../backend/Backend.js';
import type { ConfigView } from '../config/Config.js';
import type { ToolProvider, ToolResult } from '../capability/ToolProvider.js';
import { CapabilityRegistryImpl } from '../capability/CapabilityRegistry.js';
import { InMemoryEventLog } from '../eventlog/InMemoryEventLog.js';
import type { CognitiveEvent } from '../events/EventTypes.js';
import { validatePayload } from '../events/EventTypes.js';

export interface BackendHealth {
  status: 'healthy' | 'degraded' | 'down';
  lastEventAt?: number;
  eventRate?: number;
  detail?: string;
}

export interface KernelMetrics {
  eventsAppended: number;
  eventsProjected: number;
  backendCount: number;
  uptimeMs: number;
}

export class Kernel {
  #log: EventLog;
  #backends: Map<string, Backend> = new Map();
  #registry: CapabilityRegistryImpl;
  #configViews: Map<string, ConfigView> = new Map();
  #tools: Map<string, ToolDefinition> = new Map();
  #toolBackends: Map<string, string> = new Map();
  #healthListeners: Set<(health: Map<string, BackendHealth>) => void> = new Set();
  #metricsListeners: Set<(metrics: KernelMetrics) => void> = new Set();
  #startTime = 0;

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

  get tools(): ReadonlyMap<string, ToolDefinition> {
    return this.#tools;
  }

  async register(backend: Backend): Promise<void> {
    await this.#log.append({
      type: 'backend.registered',
      payload: { manifest: backend.manifest },
      correlationId: randomUUID(),
    });

    const configView = new ConfigViewImpl(this.#log);
    this.#configViews.set(backend.id, configView);

    // Auto-register tools if backend implements ToolProvider
    if (isToolProvider(backend)) {
      for (const tool of backend.getTools()) {
        this.#tools.set(tool.name, tool);
        this.#toolBackends.set(tool.name, backend.id);
      }
    }

    await backend.initialize(this.#log, configView);
    this.#backends.set(backend.id, backend);
  }

  getBackend(id: string): Backend | undefined {
    return this.#backends.get(id);
  }

  getBackends(): ReadonlyMap<string, Backend> {
    return this.#backends;
  }

  getTool(name: string): ToolDefinition | undefined {
    return this.#tools.get(name);
  }

  findToolBackend(toolName: string): string | undefined {
    return this.#toolBackends.get(toolName);
  }

  async requestTool(toolName: string, args: Record<string, unknown>, correlationId?: string): Promise<ToolResult> {
    const backendId = this.#toolBackends.get(toolName);
    if (!backendId) return { success: false, content: null, error: `No backend registered for tool "${toolName}"` };

    const backend = this.#backends.get(backendId);
    if (!backend || !isToolProvider(backend)) return { success: false, content: null, error: `Backend "${backendId}" does not support tool execution` };

    const cid = correlationId ?? randomUUID();
    const start = Date.now();
    const result = await backend.executeTool(toolName, args, cid);
    const durationMs = Date.now() - start;

    await this.#log.append({
      type: 'tool.response',
      payload: { requestId: cid, toolName, result: result.content, error: result.error, durationMs },
      correlationId: cid,
    });

    return result;
  }

  health(): Map<string, BackendHealth> {
    const result = new Map<string, BackendHealth>();
    for (const [id, backend] of this.#backends) {
      const h = isHealthProvider(backend) ? backend.health() : { status: 'healthy' as const };
      result.set(id, h);
    }
    return result;
  }

  onHealthChange(listener: (health: Map<string, BackendHealth>) => void): () => void {
    this.#healthListeners.add(listener);
    return () => this.#healthListeners.delete(listener);
  }

  onMetrics(listener: (metrics: KernelMetrics) => void): () => void {
    this.#metricsListeners.add(listener);
    return () => this.#metricsListeners.delete(listener);
  }

  async start(configPath?: string): Promise<void> {
    this.#startTime = Date.now();
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

    this.#notifyMetrics();
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

  #notifyMetrics(): void {
    const metrics: KernelMetrics = {
      eventsAppended: 0,
      eventsProjected: 0,
      backendCount: this.#backends.size,
      uptimeMs: this.#startTime ? Date.now() - this.#startTime : 0,
    };
    for (const listener of this.#metricsListeners) {
      listener(metrics);
    }
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

function isToolProvider(backend: Backend): backend is Backend & ToolProvider {
  const tp = backend as unknown as ToolProvider;
  return typeof tp.getTools === 'function' && typeof tp.executeTool === 'function';
}

interface HealthProvider {
  health(): BackendHealth;
}

function isHealthProvider(backend: Backend): backend is Backend & HealthProvider {
  return 'health' in backend && typeof (backend as HealthProvider).health === 'function';
}

import { ConfigViewImpl } from '../config/ConfigView.js';