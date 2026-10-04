/** Health, telemetry and micro-benchmark commands (`.doctor`, `.health`, `.spend`, `.benchmarks`, …). */

import { resolveLMSettings } from '@senars/nar/lm';
import { clamp, envSet, errMsg, finiteOr, perSecond, stopwatch } from '@senars/util';
import { cmd } from '../../cli/commands.js';
import { flagsOf } from './args.js';
import type { BotRuntime } from './context.js';

const CREDENTIAL_KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'LM_API_KEY'];

export const diagnosticCommandsFor = (rt: BotRuntime) => [
  cmd('doctor', 'Lightweight health check', async (args = '') => {
    const s = resolveLMSettings();
    const creds = CREDENTIAL_KEYS.map((k) => `${k}=${envSet(k) ? 'set' : 'unset'}`).join(' ');
    let embedded = 'n/a';
    if (s.provider === 'llamacpp-embedded') {
      try {
        const { probeEmbeddedLlama } = await import(
          '@senars/nar/lm/providers/embedded-llamacpp.js'
        );
        const r = await probeEmbeddedLlama();
        embedded = `${r.available ? 'ok' : 'FAIL'}: ${r.detail}`;
      } catch (e) {
        embedded = `probe failed: ${errMsg(e)}`;
      }
    }
    let configValid = true;
    try {
      const { loadConfig } = await import('../../config/index.js');
      await loadConfig();
    } catch {
      configValid = false;
    }
    if (flagsOf(args).has('--json')) {
      return JSON.stringify(
        { provider: s.provider, model: s.model ?? 'default', embedded, configValid, creds },
        null,
        2
      );
    }
    return `provider=${s.provider} model=${s.model ?? 'default'}\nembedded: ${embedded}\nconfig: ${configValid ? 'valid' : 'INVALID'}\n${creds}`;
  }),
  cmd('health', 'Quick health check', async () => {
    const s = resolveLMSettings();
    return `lm=${s.provider} systemOne=${rt.wired.nar.isSystemOneEnabled?.() ? 'on' : 'off'} manifold=${rt.wired.nar.getSystemOneManifold?.() ? 'up' : '—'} connections=${rt.cm.getConnections().size}`;
  }),
  cmd('routing-log', 'Routing telemetry status', async () => {
    try {
      const { getRoutingLogStatus } = await import('@senars/nar/lm/providers.js');
      const st = getRoutingLogStatus();
      return `enabled=${st.enabled} buffered=${st.bufferSize} log=${st.logPath}`;
    } catch (e) {
      return `routing-log unavailable: ${errMsg(e)}`;
    }
  }),
  cmd('spend', 'LM spend counters', () => {
    const spend = rt.wired.nar.getLMClient?.()?.getSpend?.() as
      | Record<string, { calls: number; tokensIn: number; tokensOut: number }>
      | undefined;
    return spend && Object.keys(spend).length
      ? Object.entries(spend)
          .map(([p, v]) => `  ${p}: ${v.calls} calls in=${v.tokensIn} out=${v.tokensOut}`)
          .join('\n')
      : 'No LM spend recorded';
  }),
  cmd('gates', 'Kernel gate states', () => {
    try {
      const gates = (rt.wired.nar as unknown as { gates?: object }).gates;
      return Object.keys(gates ?? {}).join(', ') || 'gates: n/a';
    } catch (e) {
      return `gates unavailable: ${errMsg(e)}`;
    }
  }),
  cmd('benchmarks', 'Micro-benchmark: time NAR inference cycles', async (args = '') => {
    const cycles = clamp(finiteOr(args.trim(), 20), 1, 200);
    const elapsed = stopwatch();
    const derived = await rt.wired.nar.run(cycles);
    const ms = elapsed();
    return `${cycles} cycles in ${ms}ms (${perSecond(cycles, ms).toFixed(0)} cyc/s), derivations=${derived}\nFull suites: pnpm bench`;
  }),
  cmd('selftune', 'Quick 3-iteration self-tune demo', async () => {
    const { RLFPLearner } = await import('@senars/nar/rlfp');
    const { DEFAULT_COGNITIVE_PARAMETERS } = await import(
      '@senars/nar/config/cognitive-parameters.js'
    );
    const rlfp = new RLFPLearner({ currentParams: { ...DEFAULT_COGNITIVE_PARAMETERS } });
    let best = -Infinity;
    for (let i = 0; i < 3; i++) {
      best = Math.max(
        best,
        rlfp.calculateReward({
          testPassRate: 0.8,
          avgTestDuration: 90,
          coverageDelta: 0.01,
          memoryOverage: 0.05,
          cpuThrottleTime: 2,
          baselineDuration: 100,
        })
      );
    }
    return `selftune demo: 3 iters, best reward=${best.toFixed(4)} (full run: pnpm self-tune-demo)`;
  }),
];
