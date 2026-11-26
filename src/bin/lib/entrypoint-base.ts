/**
 * Unified entry point infrastructure — shared wiring, lifecycle, and CLI patterns.
 *
 * Only exports what's actually used by entry points.
 */

import { createAgentFromEnv, runAgent, type AgentFromEnvResult } from './lifecycle';
import { readAppEnvConfig } from './env-config';
import { createLogger } from '@senars/util/logger';
import { setupGracefulShutdown } from '@senars/util/shutdown';
import type { ExtendedAgent } from '@senars/agent';
import type { NAR } from '@senars/agent';

const logger = createLogger({ scope: 'entrypoint-base' });

/** Standard agent wiring result for entry points that need full bot runtime. */
export interface WiredAgent {
  agent: ExtendedAgent;
  nar: NAR;
  appConfig: Awaited<ReturnType<typeof import('../../config/index').loadConfig>>;
  profile: Awaited<ReturnType<typeof import('../../config/index').loadConfig>>['profile'];
}

/** Create the standard wired agent used by most entry points. */
export async function createWiredAgent(): Promise<WiredAgent> {
  const wired = await createAgentFromEnv();
  return {
    agent: wired.agent,
    nar: wired.nar,
    appConfig: wired.appConfig,
    profile: wired.profile,
  };
}

/**
 * Start Web UI if enabled (shared across entry points).
 */
export async function maybeStartWebUI(
  agent: ExtendedAgent,
  enabled: boolean,
  port?: number,
  logger?: { info: (msg: string) => void; error: (msg: string, err: Error) => void }
): Promise<void> {
  if (!enabled) return;
  try {
    const { startAgentUI } = await import('../../ui/src/server/index');
    await startAgentUI(agent, { port: port ?? 8765 });
    logger?.info(`Web UI at http://localhost:${port ?? 8765}`);
  } catch (err) {
    logger?.error('Web UI failed to start', err as Error);
  }
}

export { runEntrypoint } from './fatal-error';
export { createLogger } from '@senars/util/logger';