import type { CognitiveEvent } from './CognitiveEvent.js';
import type { Agent } from './Agent.js';
import type { Engine, EngineId } from './engine/Engine.js';
import type { ToolSpec } from './motor/ToolRegistry.js';
import type { LensSpec } from './lens-schema.js';
import type { Connection, ConnectionConfig, ConnectionDeps } from './Transport.js';

/** A plugin-provided transport: a named factory that builds a connection. */
export interface TransportFactory {
  readonly id: string;
  readonly type: string;
  create(config: ConnectionConfig, deps: ConnectionDeps): Connection;
}

/**
 * The whole mind, exposed to symbiotic extensions. A plugin receives one
 * context and extends engines, tools, lenses, transports, or memory tiers.
 */
export interface PluginContext {
  readonly agent: Agent;
  registerEngine(id: EngineId, engine: Engine): void;
  registerTool(spec: ToolSpec): void;
  registerLens(spec: LensSpec): void;
  registerTransport(factory: TransportFactory): void;
  addMemoryTier(name: string, impl: unknown): void;
  onCognitive(handler: (e: CognitiveEvent) => void): () => void;
}

export interface SenarsPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  activate(ctx: PluginContext): void;
  deactivate(): void;
}
