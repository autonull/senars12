import { execFile } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

// The lane runs one bin's lifecycle per child process (drivers/bin-lifecycle-driver.ts):
// node-llama-cpp generation segfaults inside vitest workers, and a real child is the
// honest shape for bin-lifecycle anyway. Default provider is the embedded llama.cpp
// runtime over a local GGUF (LM_PROVIDER / LM_LLAMACPP_MODEL env wins).
const root = fileURLToPath(new URL('../..', import.meta.url));

interface BinSpec {
  name: string;
}

const bins: BinSpec[] = [
  { name: 'senars' },
  { name: 'repl' },
  { name: 'bot-ai' },
  { name: 'mcp-server' },
  { name: 'multi-agent' },
  { name: 'multi-agent-demo' },
];

const runDriver = (bin: string): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'tests/e2e/drivers/bin-lifecycle-driver.ts'],
      {
        cwd: root,
        timeout: 300_000,
        killSignal: 'SIGKILL',
        env: {
          ...process.env,
          LANE_BIN: bin,
          LM_PROVIDER: process.env.LM_PROVIDER ?? 'llamacpp-embedded',
          LM_LLAMACPP_MODEL: process.env.LM_LLAMACPP_MODEL ?? '.models/Qwen3.5-0.8B-Q4_0.gguf',
          EPISODIC_MEMORY_PATH: '.cache/e2e-episodes',
        },
      },
      (error, stdout, stderr) => {
        if (error) reject(new Error(`${stderr || stdout || error.message}`.slice(0, 400)));
        else resolve(String(stdout));
      }
    );
  });

describe('Bin lifecycle E2E (shared createAgentFromEnv substrate)', () => {
  it.each(bins.map((b) => [b.name] as const))(
    'bin "%s" starts healthy, responds to Narsese, and shuts down',
    async (bin) => {
      const stdout = await runDriver(bin);
      expect(stdout).toContain('ok:');
    },
    360_000
  );
});
