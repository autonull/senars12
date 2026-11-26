/**
 * `senars serve mcp` — MCP Server (stdio, SSE, Streamable HTTP)
 *
 * Runs the SeNARS MCP Server with NAR tools registered.
 * Single shared NAR/agent instance — MCP tools, resources and the agent
 * all operate on the same cognitive core.
 */

import { DialogueCapture } from '@senars/dialogue';
import { createLogger, envStr, parseFlags, setupGracefulShutdown } from '@senars/util';
import { runEntrypoint } from '../../lib/fatal-error';
import { createAgentFromEnv } from '../../lib/lifecycle';
import {
  createMcpServer,
  HttpGuard,
  getTransportType,
  getHttpPort,
  startStdio,
  startSse,
  startHttp,
} from '../../lib/mcp/transports';
import {
  JobManager,
  registerNARTools,
  registerDialogueTools,
  registerMCPResources,
  registerMCPPrompts,
} from '../../lib/mcp';
import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';

const logger = createLogger({ scope: 'serve:mcp' });

export const sections: HelpSection[] = [
  standardSections.usage('senars serve mcp', 'Start MCP server (stdio, SSE, or Streamable HTTP)'),
  {
    title: 'Transport',
    lines: [
      '--transport <type>    Transport: stdio | sse | http (default: stdio)',
      '--port <number>       HTTP port for SSE/HTTP (default: 8766, env MCP_PORT)',
      '--host <address>      Bind address (default: 0.0.0.0)',
    ],
  },
  {
    title: 'Authentication & Rate Limiting',
    lines: [
      '--api-key <key>       API key for HTTP transports (env MCP_API_KEY)',
      '--rate-limit <rpm>    Requests per minute (default: 30, env MCP_RATE_LIMIT)',
      '--api-key-env <var>   Environment variable containing API key',
    ],
  },
  {
    title: 'Profile',
    lines: [
      '-p, --profile <kind>  Profile: logic | coprocessor | agent | device (default: agent)',
      '--web-ui              Enable Web UI',
      '--port <number>       Web UI port (default: 8765)',
    ],
  },
  standardSections.examples([
    'senars serve mcp',
    'senars serve mcp --transport sse --port 3000',
    'senars serve mcp --transport http --port 8766 --api-key secret',
    'senars serve mcp --profile coprocessor --web-ui',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const transportType = getTransportType(argv);
  const port = getHttpPort(argv);
  const host = argv.str('--host', '0.0.0.0');
  const apiKey = argv.str('--api-key', envStr('MCP_API_KEY'));
  const rateLimit = argv.num('--rate-limit', envStr('MCP_RATE_LIMIT') ? parseInt(envStr('MCP_RATE_LIMIT')!, 10) : 30);
  const apiKeyEnv = argv.str('--api-key-env');

  // Create MCP server
  const server = createMcpServer();

  // Single shared NAR/agent instance — MCP tools, resources and the agent
  // all operate on the same cognitive core.
  const { nar, agent, appConfig, episodicMemory, sessionManager } = await createAgentFromEnv();
  const jobs = new JobManager();
  await sessionManager.restore();

  registerNARTools(server, nar, agent, { jobs, approval: appConfig.connections?.mcp?.approval });
  registerMCPResources(server, { nar, agent, jobs, sessions: sessionManager });
  registerMCPPrompts(server);

  // Dialogue Flywheel tools when enabled.
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

  // Resolve API key from env var if specified
  const resolvedApiKey = apiKeyEnv ? envStr(apiKeyEnv) ?? apiKey : apiKey;

  let closeTransport: Awaited<ReturnType<typeof startStdio>>;

  switch (transportType) {
    case 'stdio': {
      closeTransport = await startStdio(server);
      logger.info('SeNARS MCP Server started on stdio');
      break;
    }
    case 'sse':
    case 'http': {
      const guard = new HttpGuard({ apiKey: resolvedApiKey, rateLimitPerMinute: rateLimit });
      if (!resolvedApiKey) logger.info(`MCP API key (client x-api-key header): ${guard.activeKey}`);
      closeTransport = transportType === 'sse' ? startSse(port, guard, server) : startHttp(port, guard, server);
      logger.info(`SeNARS MCP Server started on ${transportType.toUpperCase()} at http://${host}:${port}/mcp`);
      break;
    }
    default:
      throw new Error(`Unknown transport: ${transportType}`);
  }

  setupGracefulShutdown(async () => {
    await closeTransport();
  }, logger);
}

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runEntrypoint(() => runCLI(main, { sections, version: '0.0.0' }));
}