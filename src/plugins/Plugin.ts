import type { CognitiveEvent } from '../schemas/index';
import type { Agent } from '../agent/Agent';
import type { Engine, EngineId } from '../engine/Engine';
import type { LensSpec } from '../protocol/lens-schema';
import type { ToolSpec } from '../motor/ToolRegistry';
import type { Connection, ConnectionConfig, ConnectionDeps } from '../agent/Transport';

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
