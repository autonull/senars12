import type { ProbeResult, ScenarioResult } from './framework.js';
import type { LMProvider } from './providers.js';

export interface TestReport {
  provider: string;
  model: string;
  timestamp: number;
  scenarios: Array<{
    name: string;
    probes: ProbeResult[];
    passed: number;
    failed: number;
    durationMs: number;
  }>;
  totals: { passed: number; failed: number; durationMs: number };
}

export function buildReport(
  provider: LMProvider,
  model: string,
  results: ScenarioResult[]
): TestReport {
  const totals = results.reduce(
    (acc, r) => ({
      passed: acc.passed + r.passed,
      failed: acc.failed + r.failed,
      durationMs: acc.durationMs + r.durationMs,
    }),
    { passed: 0, failed: 0, durationMs: 0 }
  );

  return {
    provider,
    model,
    timestamp: Date.now(),
    scenarios: results.map((r) => ({
      name: r.name,
      probes: r.probes,
      passed: r.passed,
      failed: r.failed,
      durationMs: r.durationMs,
    })),
    totals,
  };
}

export function formatHumanReadable(report: TestReport): string {
  const lines: string[] = [];
  lines.push(`Conversational Test Report`);
  lines.push(`${'='.repeat(40)}`);
  lines.push(`Provider: ${report.provider}:${report.model}`);
  lines.push(`Time: ${new Date(report.timestamp).toISOString()}`);
  lines.push('');

  for (const scenario of report.scenarios) {
    const icon = scenario.failed > 0 ? 'FAIL' : 'PASS';
    lines.push(`[${icon}] ${scenario.name} (${scenario.durationMs}ms)`);

    for (const probe of scenario.probes) {
      const probeIcon = probe.errors.length > 0 ? 'x' : 'ok';
      const responsePreview =
        probe.response.length > 80 ? probe.response.slice(0, 80) + '...' : probe.response;
      lines.push(`  [${probeIcon}] "${probe.input}"`);
      lines.push(`       → ${responsePreview}`);
      if (probe.beliefsAfter > probe.beliefsBefore) {
        lines.push(`       beliefs: ${probe.beliefsBefore} → ${probe.beliefsAfter}`);
      }
      if (probe.derivations > 0) {
        lines.push(`       derivations: +${probe.derivations}`);
      }
      if (probe.lmCalls > 0) {
        lines.push(`       lm calls: ${probe.lmCalls}`);
      }
      if (probe.errors.length > 0) {
        lines.push(`       errors: ${probe.errors.join('; ')}`);
      }
    }
    lines.push('');
  }

  lines.push(`${'='.repeat(40)}`);
  lines.push(
    `Total: ${report.totals.passed} passed, ${report.totals.failed} failed (${report.totals.durationMs}ms)`
  );
  return lines.join('\n');
}

export function formatJson(report: TestReport): string {
  return JSON.stringify(report, null, 2);
}
