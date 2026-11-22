/**
 * Deck Treadmill — consolidated cognitive treadmill (gallery treadmill).
 *
 * This brings the CognitiveTreadmill from imagination into the deck
 * as a first-class view for stress testing and scenario generation.
 */

import type { NAR } from '../nar';
import { CognitiveTreadmill, createTreadmill, type TreadmillConfig, type Scenario, type StressMetrics, type DegradationCurve } from '../imagination/index';

/**
 * Treadmill view mode for deck.
 */
export type TreadmillViewMode = 'scenario' | 'overload' | 'metrics' | 'events';

/**
 * Deck treadmill state.
 */
export interface DeckTreadmillState {
  /** Current view mode. */
  viewMode: TreadmillViewMode;
  /** Active scenario. */
  scenario?: Scenario;
  /** Scenario result. */
  result?: {
    success: boolean;
    stepsExecuted: number;
    durationMs: number;
    metrics: StressMetrics;
    cognitiveEvents: import('@senars/schemas').CognitiveEvent[];
  };
  /** Overload sweep curve. */
  curve?: DegradationCurve;
  /** Configuration. */
  config: TreadmillConfig;
  /** Running state. */
  running: boolean;
}

/**
 * Create a deck treadmill state.
 */
export function createDeckTreadmill(nar: NAR, config?: Partial<TreadmillConfig>): {
  state: DeckTreadmillState;
  treadmill: CognitiveTreadmill;
  runScenario: (scenario: Scenario) => Promise<void>;
  runOverloadSweep: (baseScenario: Scenario, multipliers?: number[]) => Promise<void>;
  setViewMode: (mode: TreadmillViewMode) => void;
} {
  const treadmill = createTreadmill(nar, config);

  const state: DeckTreadmillState = {
    viewMode: 'scenario',
    config: treadmill.config as TreadmillConfig,
    running: false,
  };

  async function runScenario(scenario: Scenario): Promise<void> {
    state.running = true;
    state.scenario = scenario;
    state.viewMode = 'scenario';

    try {
      const result = await treadmill.runScenario(scenario);
      state.result = result;
      state.viewMode = 'metrics';
    } finally {
      state.running = false;
    }
  }

  async function runOverloadSweep(baseScenario: Scenario, multipliers?: number[]): Promise<void> {
    state.running = true;
    state.scenario = baseScenario;
    state.viewMode = 'overload';

    try {
      const curve = await treadmill.runOverloadSweep(baseScenario, multipliers);
      state.curve = curve;
      state.viewMode = 'metrics';
    } finally {
      state.running = false;
    }
  }

  function setViewMode(mode: TreadmillViewMode): void {
    state.viewMode = mode;
  }

  return { state, treadmill, runScenario, runOverloadSweep, setViewMode };
}

/**
 * Render treadmill scenario view.
 */
export function renderTreadmillScenario(state: DeckTreadmillState): string {
  const s = state.scenario;
  if (!s) return 'No scenario loaded';

  return `
╔══════════════════════════════════════════════════════════════╗
║ TREADMILL — SCENARIO                                       ║
╠══════════════════════════════════════════════════════════════╣
║ Profile: ${(s.profile ?? 'unknown').padEnd(54)}║
║ Seed: ${String(s.seed).padEnd(56)}║
║ Events: ${String(s.events.length).padEnd(55)}║
║ ${state.running ? '▶ RUNNING' : '■ READY'.padEnd(56)}║
╚══════════════════════════════════════════════════════════════╝
  `.trim();
}

/**
 * Render treadmill metrics view.
 */
export function renderTreadmillMetrics(state: DeckTreadmillState): string {
  const r = state.result;
  if (!r) return 'No metrics available';

  const m = r.metrics;
  const bar = (val: number, width = 20) => '█'.repeat(Math.floor(val * width)) + '░'.repeat(width - Math.floor(val * width));

  return `
╔══════════════════════════════════════════════════════════════╗
║ TREADMILL — METRICS                                        ║
╠══════════════════════════════════════════════════════════════╣
║ Status: ${r.success ? 'SUCCESS' : 'FAILED'.padEnd(55)}║
║ Steps: ${String(r.stepsExecuted).padEnd(56)}║
║ Duration: ${String(r.durationMs) + 'ms'.padEnd(51)}║
║ Throughput: ${m.throughput.toFixed(2) + ' ops/s'.padEnd(50)}║
║ Latency P50: ${String(m.latencyP50.toFixed(1)) + 'ms'.padEnd(51)}║
║ Latency P95: ${String(m.latencyP95.toFixed(1)) + 'ms'.padEnd(51)}║
║ Latency P99: ${String(m.latencyP99.toFixed(1)) + 'ms'.padEnd(51)}║
║ Contradiction Rate: ${bar(m.contradictionRate)} ${(m.contradictionRate * 100).toFixed(1)}%║
║ Derivation Quality: ${bar(m.derivationQuality)} ${(m.derivationQuality * 100).toFixed(1)}%║
║ Memory Pressure: ${bar(m.memoryPressure)} ${(m.memoryPressure * 100).toFixed(1)}%║
║ Priority Oscillation: ${String(m.priorityOscillation.toFixed(3)).padEnd(43)}║
╚══════════════════════════════════════════════════════════════╝
  `.trim();
}

/**
 * Render treadmill overload sweep view.
 */
export function renderTreadmillOverload(state: DeckTreadmillState): string {
  const c = state.curve;
  if (!c) return 'No overload sweep data';

  const lines = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `║ TREADMILL — OVERLOAD SWEEP                                ║`,
    `╠══════════════════════════════════════════════════════════════╣`,
  ];

  for (const point of c.points) {
    const qualityBar = '█'.repeat(Math.floor(point.quality * 15));
    const knee = point.isKnee ? ' ← KNEE' : '';
    lines.push(`║ ${String(point.multiplier).padStart(4)}x │ Quality: ${qualityBar.padEnd(15)} ${(point.quality * 100).toFixed(1)}%${knee} ║`);
  }

  if (c.kneePoint) {
    lines.push(`║ Knee at ${c.kneePoint.multiplier}x (quality dropped below 80%)           ║`);
  }

  lines.push(`╚══════════════════════════════════════════════════════════════╝`);

  return lines.join('\n');
}

/**
 * Render treadmill events view.
 */
export function renderTreadmillEvents(state: DeckTreadmillState): string {
  const events = state.treadmill?.getEventLog() ?? [];
  const recent = events.slice(-10);

  const lines = [
    `╔══════════════════════════════════════════════════════════════╗`,
    `║ TREADMILL — EVENT LOG (last ${String(recent.length).padStart(2)} of ${events.length})    ║`,
    `╠══════════════════════════════════════════════════════════════╣`,
  ];

  for (const event of recent) {
    const type = event.type.padEnd(25);
    const detail = JSON.stringify(event.payload).slice(0, 30).padEnd(30);
    lines.push(`║ ${type} │ ${detail} ║`);
  }

  if (recent.length === 0) {
    lines.push(`║ No events recorded                                        ║`);
  }

  lines.push(`╚══════════════════════════════════════════════════════════════╝`);

  return lines.join('\n');
}

/**
 * Render current treadmill view.
 */
export function renderDeckTreadmill(state: DeckTreadmillState): string {
  switch (state.viewMode) {
    case 'scenario':
      return renderTreadmillScenario(state);
    case 'metrics':
      return renderTreadmillMetrics(state);
    case 'overload':
      return renderTreadmillOverload(state);
    case 'events':
      return renderTreadmillEvents(state);
    default:
      return 'Unknown treadmill view mode';
  }
}