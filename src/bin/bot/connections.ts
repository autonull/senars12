/**
 * Connection factories and management for the bot.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  AuthManager,
  bindAgentToConnection,
  CLIConnection,
  type Connection,
  ConnectionManager,
  createConnectionConfigsFromEnv,
  HTTPConnection,
  IRCConnection,
  MCPConnection,
  WSConnection,
} from '@senars/io';
import { createReasoningRoute, handleMetricsRequest, type ReasoningHttpEngine } from '@senars/metrics';
import { createLogger, type Logger } from '@senars/util/logger';

/** HTTP routes served ahead of auth. */
let httpKernel: ReasoningHttpEngine | undefined;
const reasoningRoute = createReasoningRoute(() => httpKernel);

export const serveHttpRoutes = async (req: IncomingMessage, res: ServerResponse): Promise<boolean> =>
  (await handleMetricsRequest(req, res)) || reasoningRoute(req, res);

/** Connection types the bot can construct. */
export const createConnectionFactories = (logger: Logger) => ({
  cli: (cfg: never) => new CLIConnection(cfg, { emit: () => undefined, logger } as never),
  irc: (cfg: never) => new IRCConnection(cfg, { emit: () => undefined, logger } as never),
  websocket: (cfg: never) => new WSConnection(cfg, { emit: () => undefined, logger } as never),
  http: (cfg: never) =>
    new HTTPConnection(cfg, { emit: () => undefined, logger, httpRoute: serveHttpRoutes } as never),
  mcp: (cfg: never) => new MCPConnection(cfg, { emit: () => undefined, logger } as never),
} as const);

/** Register connection factories with the manager. */
export function registerConnectionFactories(cm: ConnectionManager, factories: ReturnType<typeof createConnectionFactories>): void {
  for (const [type, create] of Object.entries(factories)) {
    cm.registerFactory({ type, create: create as never });
  }
}

/** Bind agent to a connection with shared dependencies. */
export function createBindTo(
  agent: unknown,
  auth: AuthManager,
  registry: unknown,
  sessionManager: unknown,
  episodicMemory: unknown,
  cm: ConnectionManager
): (conn: Connection) => void {
  return (conn: Connection) => {
    bindAgentToConnection(
      agent as never,
      conn as never,
      { auth, commandRegistry: registry, sessionManager, episodicMemory, manager: cm } as never
    );
  };
}

/** Auto-connect from environment config. */
export async function autoConnect(
  cm: ConnectionManager,
  bindTo: (conn: Connection) => void,
  appConfig: unknown,
  logger: Logger
): Promise<void> {
  const { createConnectionConfigsFromEnv: createConfigs } = await import('@senars/io');
  const configs = createConfigs({ irc: (appConfig as any).connections?.irc });

  for (const cfg of configs) {
    if (cfg.type === 'irc' || cfg.type === 'websocket') {
      cfg.config.greeting ??= (appConfig as any).profile?.joinMessage;
    }
  }

  for (const cfg of configs) {
    try {
      const conn = await cm.addConnection(cfg, { emit: () => undefined, logger });
      bindTo(conn);
      logger.info(`Bound bridge to: ${conn.name} (${conn.type})`);
    } catch (e) {
      logger.error(`Failed to add ${cfg.type}: ${(e as Error).message}`);
    }
  }
}