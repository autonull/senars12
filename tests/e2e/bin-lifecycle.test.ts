import { createAgentFromEnv, type AgentFromEnvOptions } from '../../src/bin/lib/lifecycle';
import { afterEach, describe, expect, it } from 'vitest';

interface BinSpec {
  name: string;
  options?: AgentFromEnvOptions;
}

const bins: BinSpec[] = [
  { name: 'senars', options: { narConfig: { maxConcepts: 100 } } },
  { name: 'repl' },
  { name: 'bot-ai' },
  { name: 'mcp-server' },
  { name: 'multi-agent', options: { narConfig: { maxConcepts: 50 } } },
  { name: 'multi-agent-demo', options: { narConfig: { maxConcepts: 50 } } },
];

describe('Bin lifecycle E2E (shared createAgentFromEnv substrate)', () => {
  const created: Awaited<ReturnType<typeof createAgentFromEnv>>[] = [];

  afterEach(async () => {
    await Promise.all(created.map((c) => c.agent.stop().catch(() => {})));
    created.length = 0;
  });

  it.each(bins.map((b) => [b.name, b.options] as const))(
    'bin "%s" starts healthy, responds to Narsese, and shuts down',
    async (_name, options) => {
      process.env.EPISODIC_MEMORY_PATH = '.cache/e2e-episodes';
      const ctx = await createAgentFromEnv(options ?? undefined);
      created.push(ctx);

      const health = ctx.agent.health();
      expect(health.status).toBe('healthy');

      const deltas: string[] = [];
      const gen = ctx.agent.chat('<cat --> mammal>.');
      for await (const ev of gen) {
        if (ev.kind === 'text-delta') deltas.push(ev.text);
      }
      const response = deltas.join('');
      expect(response.length).toBeGreaterThan(0);
      expect(response).toContain('cat');

      await ctx.agent.stop();
      expect(ctx.agent.health().status).toBe('stuck');
    },
  );
});
