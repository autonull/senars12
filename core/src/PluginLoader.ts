import type { Agent } from './Agent.js';
import type { Engine, EngineId } from './engine/Engine.js';
import type { ToolSpec } from './motor/ToolRegistry.js';
import type { CognitiveEvent } from './CognitiveEvent.js';
import type { SenarsPlugin, TransportFactory } from './Plugin.js';
import type { LensSpec } from './lens-schema.js';

export class PluginLoadError extends Error {
  constructor(public readonly pluginId: string, cause: unknown) {
    super(`Failed to load plugin "${pluginId}": ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'PluginLoadError';
  }
}

interface LoadedPlugin {
  plugin: SenarsPlugin;
  deactivate: () => void;
}

/**
 * Discovers and activates plugins, giving each a view of the whole mind.
 * The agent is a platform, not a product: every organ can arrive via plugin.
 */
export class PluginLoader {
  readonly #agent: Agent;
  readonly #loaded = new Map<string, LoadedPlugin>();
  readonly #lenses = new Map<string, LensSpec>();
  readonly #transports = new Map<string, TransportFactory>();

  constructor(agent: Agent) {
    this.#agent = agent;
  }

  get lenses(): LensSpec[] {
    return [...this.#lenses.values()];
  }

  get transports(): TransportFactory[] {
    return [...this.#transports.values()];
  }

  async load(plugins: SenarsPlugin[]): Promise<void> {
    for (const plugin of plugins) {
      try {
        this.activate(plugin);
      } catch (e) {
        throw new PluginLoadError(plugin.id, e);
      }
    }
  }

  activate(plugin: SenarsPlugin): void {
    if (this.#loaded.has(plugin.id)) return;
    const off = plugin.activate(this.#context());
    this.#loaded.set(plugin.id, { plugin, deactivate: off ?? (() => {}) });
  }

  unload(id: string): void {
    const entry = this.#loaded.get(id);
    if (!entry) return;
    try { entry.plugin.deactivate(); } catch { /* ignore */ }
    try { entry.deactivate(); } catch { /* ignore */ }
    this.#loaded.delete(id);
  }

  unloadAll(): void {
    for (const id of [...this.#loaded.keys()]) this.unload(id);
  }

  #context() {
    const agent = this.#agent;
    const self = this;
    return {
      agent,
      registerEngine(id: EngineId, engine: Engine) {
        agent.registerEngine(id, engine);
      },
      registerTool(spec: ToolSpec) {
        agent.motor.register(spec);
      },
      registerLens(spec: LensSpec) {
        self.#lenses.set(spec.id, spec);
      },
      registerTransport(factory: TransportFactory) {
        self.#transports.set(factory.id, factory);
      },
      addMemoryTier(name: string, impl: unknown) {
        agent.memory.addTier(name, impl);
      },
      onCognitive(handler: (e: CognitiveEvent) => void) {
        agent.on('*', handler);
        return () => agent.off('*', handler);
      },
    } satisfies import('./Plugin.js').PluginContext;
  }
}
