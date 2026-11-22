/**
 * Deck Pressure — system pressure monitoring and visualization.
 */

import type { EconomyState, SchedulerStats } from '@senars/economy/types';
import type { RepertoireStats } from '@senars/admit/repertoire';

/** Pressure metrics. */
export interface PressureMetrics {
  /** Budget utilization [0, 1]. */
  budgetUtilization: number;
  /** Attention utilization [0, 1]. */
  attentionUtilization: number;
  /** Queue pressure [0, 1]. */
  queuePressure: number;
  /** Memory pressure [0, 1]. */
  memoryPressure: number;
  /** CPU pressure [0, 1]. */
  cpuPressure: number;
  /** Timestamp. */
  timestamp: number;
}

/** Pressure thresholds. */
export interface PressureThresholds {
  /** Warning threshold. */
  warning: number;
  /** Critical threshold. */
  critical: number;
  /** Emergency threshold. */
  emergency: number;
}

/** Default pressure thresholds. */
export const defaultPressureThresholds: PressureThresholds = {
  warning: 0.7,
  critical: 0.85,
  emergency: 0.95,
};

/** Pressure level. */
export type PressureLevel = 'normal' | 'warning' | 'critical' | 'emergency';

/** Pressure monitor. */
export class PressureMonitor {
  private history: PressureMetrics[] = [];
  private thresholds: PressureThresholds;
  private maxHistory: number;

  constructor(thresholds: PressureThresholds = defaultPressureThresholds, maxHistory = 1000) {
    this.thresholds = thresholds;
    this.maxHistory = maxHistory;
  }

  /** Record pressure metrics. */
  record(metrics: PressureMetrics): PressureLevel {
    this.history.push(metrics);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    return this.getLevel(metrics);
  }

  /** Get current pressure level. */
  getLevel(metrics?: PressureMetrics): PressureLevel {
    const m = metrics ?? this.history[this.history.length - 1];
    if (!m) return 'normal';

    const maxPressure = Math.max(
      m.budgetUtilization,
      m.attentionUtilization,
      m.queuePressure,
      m.memoryPressure,
      m.cpuPressure
    );

    if (maxPressure >= this.thresholds.emergency) return 'emergency';
    if (maxPressure >= this.thresholds.critical) return 'critical';
    if (maxPressure >= this.thresholds.warning) return 'warning';
    return 'normal';
  }

  /** Get current metrics. */
  getCurrent(): PressureMetrics | null {
    return this.history[this.history.length - 1] ?? null;
  }

  /** Get history. */
  getHistory(window?: number): PressureMetrics[] {
    if (!window) return [...this.history];
    const cutoff = Date.now() - window;
    return this.history.filter(m => m.timestamp >= cutoff);
  }

  /** Get average metrics over window. */
  getAverage(window: number): PressureMetrics | null {
    const recent = this.getHistory(window);
    if (recent.length === 0) return null;

    const sum = recent.reduce((acc, m) => ({
      budgetUtilization: acc.budgetUtilization + m.budgetUtilization,
      attentionUtilization: acc.attentionUtilization + m.attentionUtilization,
      queuePressure: acc.queuePressure + m.queuePressure,
      memoryPressure: acc.memoryPressure + m.memoryPressure,
      cpuPressure: acc.cpuPressure + m.cpuPressure,
      timestamp: 0,
    }), { budgetUtilization: 0, attentionUtilization: 0, queuePressure: 0, memoryPressure: 0, cpuPressure: 0, timestamp: 0 });

    return {
      ...sum,
      budgetUtilization: sum.budgetUtilization / recent.length,
      attentionUtilization: sum.attentionUtilization / recent.length,
      queuePressure: sum.queuePressure / recent.length,
      memoryPressure: sum.memoryPressure / recent.length,
      cpuPressure: sum.cpuPressure / recent.length,
      timestamp: Date.now(),
    };
  }

  /** Check if pressure is increasing. */
  isIncreasing(window: number): boolean {
    const recent = this.getHistory(window);
    if (recent.length < 2) return false;

    const first = recent[0]!;
    const last = recent[recent.length - 1]!;

    return (
      last.budgetUtilization > first.budgetUtilization ||
      last.attentionUtilization > first.attentionUtilization ||
      last.queuePressure > first.queuePressure
    );
  }
}

/** Compute pressure from economy state. */
export function computeEconomyPressure(state: EconomyState, stats: SchedulerStats): PressureMetrics {
  const budgetUtilization = state.totalUtility > 0
    ? Math.min(1, stats.tasksScheduled / (state.totalUtility / 100))
    : 0;

  const attentionUtilization = stats.tasksScheduled > 0
    ? Math.min(1, stats.thinkDecisions / stats.tasksScheduled)
    : 0;

  const queuePressure = Math.min(1, stats.fairnessViolations / 100);

  return {
    budgetUtilization,
    attentionUtilization,
    queuePressure,
    memoryPressure: 0, // Would come from memory system
    cpuPressure: 0, // Would come from system monitor
    timestamp: Date.now(),
  };
}

/** Compute pressure from repertoire stats. */
export function computeRepertoirePressure(stats: RepertoireStats): PressureMetrics {
  const total = stats.total;
  const admitted = stats.byStatus.admitted ?? 0;
  const demoted = stats.byStatus.demoted ?? 0;
  const quarantined = stats.byStatus.quarantined ?? 0;

  const utilization = total > 0 ? admitted / total : 0;
  const problemRatio = total > 0 ? (demoted + quarantined) / total : 0;

  return {
    budgetUtilization: 0,
    attentionUtilization: 0,
    queuePressure: 0,
    memoryPressure: utilization,
    cpuPressure: problemRatio,
    timestamp: Date.now(),
  };
}

/** Pressure renderer. */
export class PressureRenderer {
  /** Render pressure as bars. */
  renderBars(metrics: PressureMetrics): string {
    const bars = [
      { label: 'Budget', value: metrics.budgetUtilization },
      { label: 'Attention', value: metrics.attentionUtilization },
      { label: 'Queue', value: metrics.queuePressure },
      { label: 'Memory', value: metrics.memoryPressure },
      { label: 'CPU', value: metrics.cpuPressure },
    ];

    let output = '╔══════════════════════════════════════════════════════════════╗\n';
    output += '║ PRESSURE                                                    ║\n';
    output += '╠══════════════════════════════════════════════════════════════╣\n';

    for (const bar of bars) {
      const filled = Math.round(bar.value * 20);
      const empty = 20 - filled;
      const barStr = '█'.repeat(filled) + '░'.repeat(empty);
      const percent = (bar.value * 100).toFixed(1).padStart(5);
      const color = bar.value > 0.85 ? '🔴' : bar.value > 0.7 ? '🟡' : '🟢';
      output += `║ ${color} ${bar.label.padEnd(10)} ${barStr} ${percent}% ║\n`;
    }

    output += '╚══════════════════════════════════════════════════════════════╝';
    return output;
  }

  /** Render pressure as JSON. */
  renderJSON(metrics: PressureMetrics): string {
    return JSON.stringify(metrics, null, 2);
  }

  /** Render pressure history as sparkline. */
  renderSparkline(history: PressureMetrics[], metric: keyof PressureMetrics): string {
    const values = history.map(m => m[metric]);
    const sparks = '▁▂▃▄▅▆▇█';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    return values.map(v => {
      const idx = Math.floor(((v - min) / range) * (sparks.length - 1));
      return sparks[idx];
    }).join('');
  }
}

/** Create pressure monitor. */
export function createPressureMonitor(thresholds?: PressureThresholds): PressureMonitor {
  return new PressureMonitor(thresholds);
}

/** Create pressure renderer. */
export function createPressureRenderer(): PressureRenderer {
  return new PressureRenderer();
}