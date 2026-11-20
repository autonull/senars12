import { Agent } from '@senars/agent';
import {
  builtinLensPlugins,
  createLensPlugin,
  createTransportPlugin,
  PluginLoader,
  type TransportRegistry,
} from '@senars/plugins';
import type { Connection, ConnectionConfig, ConnectionDeps } from '@senars/utils';
import type { EventLog } from '@senars/log';
import { describe, expect, it, vi } from 'vitest';

function createMockEventLog(): EventLog {
  const events: any[] = [];
  return {
    append: vi.fn().mockImplementation(async (event) => {
      const e = { ...event, id: `evt-${events.length}`, timestamp: Date.now() };
      events.push(e);
      return e;
    }),
    subscribe: vi.fn().mockImplementation(async function* () {
      for (const e of events) yield e;
    }),
    query: vi.fn().mockResolvedValue([]),
    getRange: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn().mockResolvedValue(null),
    saveSnapshot: vi.fn().mockResolvedValue(undefined),
  };
}

function dummyConnection(config: ConnectionConfig, _deps: ConnectionDeps): Connection {
  return {
    id: config.id,
    name: config.id,
    type: config.type,
    state: 'idle',
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    send: vi.fn(),
    onMessage: vi.fn(),
    removeMessageHandler: vi.fn(),
    onStateChange: vi.fn(),
    onError: vi.fn(),
    getStatus: () => ({ state: 'idle', messageCount: 0, errorCount: 0 }),
    reconfigure: vi.fn(),
  };
}

const mockLog = createMockEventLog();

describe('PluginLoader integration', () => {
  it('registers a transport plugin into a connection manager', () => {
    const agent = new Agent({ id: 'p', log: mockLog });
    const loader = new PluginLoader(agent);
    const plugin = createTransportPlugin({
      id: 'tp-cli',
      type: 'cli',
      name: 'CLI Transport',
      ctor: class {
        constructor(
          public config: ConnectionConfig,
          public deps: ConnectionDeps
        ) {}
      } as never,
    });
    loader.load([plugin]);
    expect(loader.transports).toHaveLength(1);

    const registered: string[] = [];
    const manager: TransportRegistry = {
      registerFactory: (f) => registered.push(f.type),
    };
    loader.applyTransports(manager);
    expect(registered).toEqual(['cli']);
  });

  it('registers built-in lens plugins', () => {
    const agent = new Agent({ id: 'l', log: mockLog });
    const loader = new PluginLoader(agent);
    loader.load(builtinLensPlugins());
    expect(loader.lenses.length).toBeGreaterThan(0);
    expect(loader.lenses.map((l) => l.id)).toContain('belief');
  });

  it('a transport plugin emits a working connection factory', () => {
    const plugin = createTransportPlugin({
      id: 'tp-dummy',
      type: 'dummy',
      name: 'Dummy Transport',
      ctor: dummyConnection as never,
    });
    const agent = new Agent({ id: 'd', log: mockLog });
    const loader = new PluginLoader(agent);
    loader.load([plugin]);
    const transports = loader.transports;
    expect(transports).toHaveLength(1);
    const factory = transports[0];
    if (!factory) throw new Error('expected one transport');
    const conn = factory.create(
      { id: 'x', type: 'dummy', enabled: true, config: {} },
      {
        emit: () => undefined,
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
          child: () => ({
            debug() {},
            info() {},
            warn() {},
            error() {},
          }),
        } as never,
      }
    );
    expect(conn.type).toBe('dummy');
  });

  it('createLensPlugin registers the lens spec through PluginContext', () => {
    const agent = new Agent({ id: 'lp', log: mockLog });
    const loader = new PluginLoader(agent);
    const plugin = createLensPlugin({
      id: 'custom',
      label: 'Custom',
      description: 'test lens',
      modulation: { op: 'const', value: 'x' },
    });
    loader.load([plugin]);
    expect(loader.lenses.find((l) => l.id === 'custom')).toBeDefined();
  });
});
