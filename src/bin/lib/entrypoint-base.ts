/**
 * Unified entry point infrastructure — shared wiring, lifecycle, and CLI patterns.
 *
 * Eliminates duplication across senars.ts, bot/index.ts, imagine.ts, mcp-server.ts, etc.
 */

import { runEntrypoint } from './fatal-error';
import { createAgentFromEnv, runAgent, type AgentFromEnvResult } from './lifecycle';
import { parseCommonFlags, runCLI, type CommonFlags, type HelpSection, maybeStartWebUI } from './cli-utils';
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

/** Standard entry point options. */
export interface EntrypointOptions {
  /** Entry point name for logging. */
  name: string;
  /** Help sections for --help. */
  helpSections: HelpSection[];
  /** Whether to start the agent by default (vs. just wiring). */
  startAgent?: boolean;
  /** Custom runner after wiring. */
  run?: (wired: WiredAgent, flags: CommonFlags) => Promise<void>;
  /** Additional flag parsing (merged with common flags). */
  extraFlags?: (flags: CommonFlags) => Promise<CommonFlags> | CommonFlags;
}

/**
 * Run a standard entry point with unified wiring, help, error handling, and optional agent startup.
 *
 * @example
 * ```ts
 * await runEntrypointStandard({
 *   name: 'my-tool',
 *   helpSections: [...],
 *   async run(wired, flags) { ... }
 * });
 * ```
 */
export async function runEntrypointStandard(options: EntrypointOptions): Promise<void> {
  const { name, helpSections, startAgent = true, run, extraFlags } = options;

  await runCLI(
    async (flags) => {
      const mergedFlags = extraFlags ? await extraFlags(flags) : flags;

      // Wire the agent
      const wired = await createWiredAgent();

      // Start agent if requested (default for interactive entry points)
      if (startAgent) {
        await runAgent(wired.agent);
      }

      // Delegate to custom runner
      if (run) {
        await run(wired, mergedFlags);
      }

      // Start Web UI if enabled
      await maybeStartWebUI(wired.agent, readAppEnvConfig().enableWebUI, undefined, logger);

      // Graceful shutdown
      setupGracefulShutdown(async () => {
        logger.info(`${name} shutting down...`);
        await wired.agent.stop();
      }, logger);
    },
    { sections: helpSections }
  );
}

/**
 * Run a non-interactive entry point (one-shot, status, doctor, etc.) that doesn't need full agent lifecycle.
 */
export async function runNonInteractiveEntrypoint(
  name: string,
  helpSections: HelpSection[],
  runner: (flags: CommonFlags) => Promise<void>
): Promise<void> {
  await runCLI(
    async (flags) => {
      await runner(flags);
    },
    { sections: helpSections }
  );
}

/**
 * Shared flag parser that adds profile-aware flags to common flags.
 */
export function parseProfileFlags(): CommonFlags & { profile?: string } {
  const flags = parseCommonFlags(require('@senars/util/cli').parseFlags());
  return flags;
}

export { runEntrypoint } from './fatal-error';
export { maybeStartWebUI } from './cli-utils';
export { createLogger } from '@senars/util/logger';