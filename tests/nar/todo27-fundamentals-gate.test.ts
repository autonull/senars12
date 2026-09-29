import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * TODO27 Bench 111 — the capability benchmark is a gate.
 *
 * `scripts/fundamentals-bench.ts` measures the things SeNARS is *for* —
 * ambiguity, multi-input synthesis, an epistemic firewall, Socratic
 * explanation, bidirectional correction, analogical leap, graceful
 * degradation — and until now nothing ran it. That is how scenario 6 sat red
 * for three days: the bench called `ShadowValidator.validate` as a boolean
 * after `a76f30f0` changed it to return a result object, and the only way to
 * find out was to run the bench by hand.
 *
 * A measurement that nobody runs is not a measurement. This runs it, under the
 * mock provider (no network, ~2 s), and fails on the same exit code the script
 * uses. The real-provider lanes are the same script with `LM_PROVIDER` set and
 * stay manual — a gate needs determinism, and a local model's is not that.
 */

const REPO = join(__dirname, '../..');
const SCENARIOS = 7;

const run = (): string => {
  try {
    return execFileSync('pnpm', ['bench:fundamentals:mock'], {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 300_000,
      env: { ...process.env, LM_PROVIDER: 'mock' },
    });
  } catch (error) {
    // The script exits non-zero when a scenario fails; the output is the finding.
    return `${(error as { stdout?: string }).stdout ?? ''}${(error as { stderr?: string }).stderr ?? ''}`;
  }
};

describe('Bench 111 — fundamentals capabilities are gated', () => {
  const output = run();
  const verdicts = [...output.matchAll(/scenario(\d):\s*(✅ PASS|❌ FAIL)/g)].map(
    ([, index = '', verdict = '']) => ({ index: Number(index), passed: verdict.includes('PASS') })
  );

  // The bench writes routing telemetry on every run; the gate should not leave
  // a new file per invocation behind.
  afterAll(() => {
    const logs = join(REPO, 'logs');
    if (!existsSync(logs)) return;
    for (const file of readdirSync(logs)) {
      if (file.startsWith('routing-') && file.endsWith('.jsonl')) rmSync(join(logs, file), { force: true });
    }
  });

  it('reports every scenario, so a scenario that vanished fails rather than passes silently', () => {
    expect(verdicts).toHaveLength(SCENARIOS);
  });

  it('passes all of them', () => {
    expect(verdicts.filter((v) => !v.passed).map((v) => `scenario${v.index}`)).toEqual([]);
  });
});
