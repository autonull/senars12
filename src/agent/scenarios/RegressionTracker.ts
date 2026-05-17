import type {BenchmarkReport} from '../scenarios/types.js';

export interface BenchmarkHistoryEntry {
    timestamp: number;
    suite: string;
    score: number;
    passed: number;
    failed: number;
}

export class RegressionTracker {
    private readonly storage: Map<string, BenchmarkHistoryEntry[]> = new Map();
    private readonly baselines: Map<string, number> = new Map();

    recordRun(report: BenchmarkReport): void {
        const entry: BenchmarkHistoryEntry = {
            timestamp: report.timestamp,
            suite: report.suite,
            score: report.score,
            passed: report.passed,
            failed: report.failed,
        };

        if (!this.storage.has(report.suite)) {
            this.storage.set(report.suite, []);
        }
        this.storage.get(report.suite)!.push(entry);
    }

    getHistory(suite: string, limit = 10): BenchmarkHistoryEntry[] {
        const entries = this.storage.get(suite) || [];
        return entries.slice(-limit);
    }

    detectRegression(suite: string): {hasRegression: boolean; delta: number; message: string} | null {
        const history = this.getHistory(suite, 10);
        if (history.length < 2) return null;

        const baseline = this.baselines.get(suite);
        const current = history[history.length - 1]!;

        if (baseline === undefined) return null;

        const delta = current.score - baseline;
        if (delta < -0.1) {
            return {
                hasRegression: true,
                delta,
                message: `Regression detected: ${(delta * 100).toFixed(1)}% score drop`,
            };
        }

        return null;
    }

    setBaseline(suite: string): void {
        const history = this.getHistory(suite, 1);
        if (history.length > 0) {
            const last = history[history.length - 1]!;
            this.baselines.set(suite, last.score);
        }
    }

    exportReport(): string {
        const lines: string[] = ['# Benchmark History Report'];
        for (const [suite, entries] of this.storage) {
            lines.push(`\n## ${suite}`);
            lines.push(`Baseline: ${this.baselines.get(suite)?.toFixed(3) ?? 'not set'}`);
            for (const entry of entries) {
                lines.push(`- ${new Date(entry.timestamp).toISOString()}: score=${entry.score.toFixed(3)}`);
            }
        }
        return lines.join('\n');
    }
}