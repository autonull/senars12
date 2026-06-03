export interface PhaseEntry {
    name: string;
    category: string;
    startTime: number;
    endTime: number;
    durationMs: number;
    data?: Record<string, unknown>;
}

export interface PhaseTimerSummary {
    totalDurationMs: number;
    phases: PhaseEntry[];
    byCategory: Record<string, { count: number; totalMs: number; avgMs: number }>;
}

export class PhaseTimer {
  private phases: PhaseEntry[] = [];
  private stack: PhaseEntry[] = [];
  private startTime = 0;

  begin(category: string, name: string, data?: Record<string, unknown>): void {
    const now = Date.now();
    if (this.stack.length === 0) this.startTime = now;
    this.stack.push({name, category, startTime: now, endTime: 0, durationMs: 0, data});
  }

  end(): void {
    const entry = this.stack.pop();
    if (!entry) return;
    entry.endTime = Date.now();
    entry.durationMs = entry.endTime - entry.startTime;
    this.phases.push(entry);
  }

  getSummary(): PhaseTimerSummary {
    const totalDurationMs = this.phases.length > 0 ? Math.max(...this.phases.map(p => p.endTime)) - Math.min(...this.phases.map(p => p.startTime)) : 0;
    const byCategory: Record<string, {count: number; totalMs: number; avgMs: number}> = {};
    for (const p of this.phases) {
      if (!byCategory[p.category]) byCategory[p.category] = {count: 0, totalMs: 0, avgMs: 0};
      byCategory[p.category]!.count++;
      byCategory[p.category]!.totalMs += p.durationMs;
      byCategory[p.category]!.avgMs = byCategory[p.category]!.totalMs / byCategory[p.category]!.count;
    }
    return {totalDurationMs, phases: [...this.phases], byCategory};
  }

  formatFlameChart(): string {
    const summary = this.getSummary();
    const lines: string[] = [`=== Temporal Trace (${summary.totalDurationMs}ms total) ===`, ''];
    for (const p of summary.phases) {
      const bar = '#'.repeat(Math.max(1, Math.round(p.durationMs / 10)));
      const pct = summary.totalDurationMs > 0 ? (p.durationMs / summary.totalDurationMs * 100).toFixed(1) : '0.0';
      lines.push(` [${p.category}] ${p.name.padEnd(40)} ${String(p.durationMs).padStart(6)}ms (${pct}%) ${bar}`);
    }
    if (Object.keys(summary.byCategory).length > 0) {
      lines.push('');
      lines.push('By Category:');
      for (const [cat, stats] of Object.entries(summary.byCategory)) {
        const pct = summary.totalDurationMs > 0 ? (stats.totalMs / summary.totalDurationMs * 100).toFixed(1) : '0.0';
        lines.push(` ${cat.padEnd(20)} ${stats.count} calls, ${stats.totalMs}ms total (${pct}%), avg ${Math.round(stats.avgMs)}ms`);
      }
    }
    return lines.join('\n');
  }

  clear(): void {
    this.phases = [];
    this.stack = [];
    this.startTime = 0;
  }

  getPhases(): readonly PhaseEntry[] {
    return this.phases;
  }
}
