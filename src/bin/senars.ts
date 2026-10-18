#!/usr/bin/env tsx
/**
 * `pnpm senars` — start the agent, and serve the web UI when one is configured.
 *
 * This used to print `UI at http://localhost:8765` unconditionally while starting
 * nothing on that port (CORE.19 C7.2). The URL is now printed only when the UI
 * actually starts; with no UI configured the entry says so, rather than pointing
 * at a port no process listens on.
 */
import { readAppEnvConfig } from './lib/env-config.js';
import { createAgentFromEnv, runAgent } from './lib/lifecycle.js';

const { agent } = await createAgentFromEnv({ narConfig: { maxConcepts: 100 } });

await runAgent(agent);

if (readAppEnvConfig().enableWebUI) {
  const { startAgentUI } = await import('../../ui/src/server/index.js');
  await startAgentUI(agent as never)
    .then(() => console.log('UI at http://localhost:8765'))
    .catch((err: unknown) => console.error('Web UI failed to start', err));
} else {
  console.log('SeNARS running (no UI; set ENABLE_WEB_UI=true to serve one).');
}
