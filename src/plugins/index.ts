import type { LensSpec } from '../lens-schema.js';
import { builtinLensSpecs } from '../lens-schema.js';
import type { ToolSpec } from '../motor/ToolRegistry.js';
import type { SenarsPlugin, TransportFactory } from '../Plugin.js';
import type { Connection, ConnectionConfig, ConnectionDeps } from '../Transport.js';

/** Wraps a connection constructor into a `TransportFactory` plugin organ. */
export function createTransportPlugin(opts: {
  id: string;
  type: string;
  name: string;
  version?: string;
  ctor: new (config: ConnectionConfig, deps: ConnectionDeps) => Connection;
}): SenarsPlugin {
  const factory: TransportFactory = {
    id: opts.id,
    type: opts.type,
    create: (config, deps) => new opts.ctor(config, deps),
  };
  return {
    id: opts.id,
    name: opts.name,
    version: opts.version ?? '1.0.0',
    activate(ctx) {
      ctx.registerTransport(factory);
    },
    deactivate() {},
  };
}

/** Builds a lens plugin from a `LensSpec`. */
export function createLensPlugin(spec: LensSpec): SenarsPlugin {
  return {
    id: `lens:${spec.id}`,
    name: `Lens · ${spec.label}`,
    version: '1.0.0',
    activate(ctx) {
      ctx.registerLens(spec);
    },
    deactivate() {},
  };
}

/** Builds a tool plugin from a `ToolSpec`. */
export function createToolPlugin(spec: ToolSpec): SenarsPlugin {
  return {
    id: `tool:${spec.name}`,
    name: `Tool · ${spec.name}`,
    version: '1.0.0',
    activate(ctx) {
      ctx.registerTool(spec);
    },
    deactivate() {},
  };
}

/** All built-in lens plugins shipped with the system. */
export function builtinLensPlugins(): SenarsPlugin[] {
  return builtinLensSpecs().map(createLensPlugin);
}
