/**
 * Bin-lifecycle driver: runs one bin's lifecycle in a dedicated child process.
 * node-llama-cpp generation segfaults inside vitest workers (native runtime ×
 * worker machinery), so the lane exercises the real reasoning path out-of-process.
 */
import { appendFileSync } from 'node:fs';
import { DEFAULT_COGNITIVE_PARAMETERS, type CognitiveParameters } from '@senars/nar/config/cognitive-parameters';

const bin = process.env.LANE_BIN ?? 'senars';

/** AIKR bound: a handful of LM rules per cycle keeps the lane off minutes-long fan-outs. */
const boundedLMParams: CognitiveParameters = {
  ...DEFAULT_COGNITIVE_PARAMETERS,
  strategies: {
    ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
    lmRule: { ...DEFAULT_COGNITIVE_PARAMETERS.strategies.lmRule, maxRules: 3 },
  },
};

/** Per-bin assembly overrides; every bin rides the bounded LM-rule posture. */
const optionsByBin: Record<string, { narConfig?: Record<string, unknown> }> = {
  senars: { narConfig: { maxConcepts: 100, cognitiveParams: boundedLMParams } },
  repl: { narConfig: { cognitiveParams: boundedLMParams } },
  'bot-ai': { narConfig: { cognitiveParams: boundedLMParams } },
  'mcp-server': { narConfig: { cognitiveParams: boundedLMParams } },
  'multi-agent': { narConfig: { maxConcepts: 50, cognitiveParams: boundedLMParams } },
  'multi-agent-demo': { narConfig: { maxConcepts: 50, cognitiveParams: boundedLMParams } },
};

const crashLog = (msg: string): void => {
  try { appendFileSync('/tmp/lane-driver.log', `[${bin}] ${msg}\n`); } catch {}
};

const { createAgentFromEnv } = await import('../../../src/bin/lib/lifecycle.js');
const ctx = await createAgentFromEnv(optionsByBin[bin] as never);

process.on('uncaughtException', (e) => { crashLog(`uncaught: ${e.stack ?? e.message}`); process.exit(3); });
process.on('unhandledRejection', (e) => { crashLog(`unhandled: ${e}`); process.exit(4); });

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let health = ctx.agent.health();
for (let waited = 0; health.status !== 'healthy' && waited < 10_000; waited += 250) {
  await sleep(250);
  health = ctx.agent.health();
}
if (health.status !== 'healthy') {
  crashLog(`health=${JSON.stringify(health)}`);
  console.error(`[driver] bin "${bin}" unhealthy: ${health.status}`);
  process.exit(1);
}

const deltas: string[] = [];
const gen = ctx.agent.chat('<cat --> mammal>.');
for await (const ev of gen) {
  if (ev.kind === 'text-delta' && ev.text) deltas.push(ev.text);
}
const response = deltas.join('');
if (response.length === 0 || !response.includes('cat')) {
  console.error(`[driver] bin "${bin}" bad response: "${response.slice(0, 80)}"`);
  process.exit(1);
}

await ctx.agent.stop();
if (ctx.agent.health().status !== 'stuck') {
  console.error(`[driver] bin "${bin}" did not shut down cleanly`);
  process.exit(1);
}

console.log(`[driver] bin "${bin}" ok: "${response.slice(0, 60)}"`);
// Natural exit (no process.exit): lets stdout flush and the native llama
// runtime unwind — a forced exit truncates output or segfaults teardown.
