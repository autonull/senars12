#!/usr/bin/env tsx
/**
 * MCP Server CLI Entry Point
 * Runs the SeNARS MCP Server with NAR tools registered
 * Supports stdio, SSE, and Streamable HTTP transports
 *
 * @deprecated Use `senars serve mcp` instead. This entry point will be removed in a future version.
 */

import { createLogger, envStr, parseFlags, setupGracefulShutdown } from '@senars/util';
import { runEntrypoint } from './lib/fatal-error';
import { createAgentFromEnv } from './lib/lifecycle';
import { DialogueCapture } from '../dialogue/index';
import {
  createMcpServer,
  HttpGuard,
  getTransportType,
  getHttpPort,
  startStdio,
  startSse,
  startHttp,
} from './lib/mcp/transports';
import {
  JobManager,
  registerNARTools,
  registerDialogueTools,
  registerMCPResources,
  registerMCPPrompts,
} from './lib/mcp';

// Deprecation warning
const logger = createLogger({ scope: 'mcp-server' });
logger.warn('DEPRECATION: `senars-mcp` is deprecated. Use `senars serve mcp` instead.');

const server = createMcpServer();
const flags = parseFlags();

async function initialize(): Promise<void> {
  // Single shared NAR/agent instance — MCP tools, resources and the agent
  // all operate on the same cognitive core.
  const { nar, agent, appConfig, episodicMemory, sessionManager } = await createAgentFromEnv();
  const jobs = new JobManager();
  await sessionManager.restore();

  registerNARTools(server, nar, agent, { jobs, approval: appConfig.connections?.mcp?.approval });
  registerMCPResources(server, { nar, agent, jobs, sessions: sessionManager });
  registerMCPPrompts(server);

  // TODO24: Dialogue Flywheel tools (react/turns/retrospect) when enabled.
  if (appConfig.dialogue?.enabled) {
    registerDialogueTools(server, {
      dialogue: new DialogueCapture({
        episodic: episodicMemory,
        dataset: (nar as any).systemOne?.dataset,
        embeddingCache: nar.getSystemOneEmbeddingCache?.(),
        contrastive: nar.getSystemOneContrastive?.(),
        config: appConfig.dialogue,
      }),
      episodic: episodicMemory,
      traceGrades: (nar as any).systemOne?.traceGradeHistory,
    });
  }

  const transportType = getTransportType(flags);
  const port = getHttpPort(flags);

  let closeTransport: Awaited<ReturnType<typeof startStdio>>;

  switch (transportType) {
    case 'stdio': {
      closeTransport = await startStdio(server);
      logger.info('SeNARS MCP Server started on stdio');
      break;
    }
    case 'sse':
    case 'http': {
      const mcpConfig = appConfig.connections?.mcp;
      const apiKey = envStr(mcpConfig?.apiKeyEnv) ?? mcpConfig?.apiKey;
      const guard = new HttpGuard({ apiKey, rateLimitPerMinute: mcpConfig?.rateLimitPerMinute });
      if (!apiKey) logger.info(`MCP API key (client x-api-key header): ${guard.activeKey}`);
      closeTransport = transportType === 'sse' ? startSse(port, guard, server) : startHttp(port, guard, server);
      break;
    }
    default:
      throw new Error(`Unknown transport: ${transportType}`);
  }

  setupGracefulShutdown(async () => {
    await closeTransport();
  }, logger);
}

runEntrypoint(initialize);