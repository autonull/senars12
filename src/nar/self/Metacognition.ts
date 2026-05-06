import type { NAR } from '../nar.js';

interface PerformanceMetrics {
  cycleCount: number;
  totalCycleTime: number;
  termCacheHits: number;
  termCacheMisses: number;
}

interface PerformanceFinding {
  type: string;
  value: number;
  belief?: string;
}

interface AnalyzerConfig {
  avgCycleTimeThreshold?: number;
  cacheHitRateThreshold?: number;
}

export class Metacognition {
  private nar: NAR | null;
  private metrics: PerformanceMetrics;
  private lastCycleStartTime: number | null;
  private config: AnalyzerConfig;

  constructor(nar: NAR | null, config: AnalyzerConfig = {}) {
    this.nar = nar;
    this.config = {
      avgCycleTimeThreshold: config.avgCycleTimeThreshold ?? 100,
      cacheHitRateThreshold: config.cacheHitRateThreshold ?? 0.8
    };
    this.metrics = {
      cycleCount: 0,
      totalCycleTime: 0,
      termCacheHits: 0,
      termCacheMisses: 0
    };
    this.lastCycleStartTime = null;
  }

  analyze(event: { eventName: string; timestamp: number }): PerformanceFinding[] {
    if (event.eventName === 'cycle_start') {
      this.metrics.cycleCount++;
      this.lastCycleStartTime = event.timestamp;
    }

    if (event.eventName === 'cycle_end' && this.lastCycleStartTime) {
      this.metrics.totalCycleTime += event.timestamp - this.lastCycleStartTime;
    }

    if (event.eventName === 'term_cache_hit') {
      this.metrics.termCacheHits++;
    }

    if (event.eventName === 'term_cache_miss') {
      this.metrics.termCacheMisses++;
    }

    return this.generateFindings();
  }

  private generateFindings(): PerformanceFinding[] {
    const findings: PerformanceFinding[] = [];
    const avgCycleTime = this.metrics.cycleCount > 0
      ? this.metrics.totalCycleTime / this.metrics.cycleCount
      : 0;
    const cacheHitRate = (this.metrics.termCacheHits + this.metrics.termCacheMisses) > 0
      ? this.metrics.termCacheHits / (this.metrics.termCacheHits + this.metrics.termCacheMisses)
      : 0;

    if (avgCycleTime > (this.config.avgCycleTimeThreshold || 100)) {
      findings.push({
        type: 'high_cycle_time',
        value: avgCycleTime,
        belief: '<(SELF, has_property, high_cycle_time) --> TRUE>.'
      });
    }

    if (cacheHitRate < (this.config.cacheHitRateThreshold || 0.8)) {
      findings.push({
        type: 'low_cache_hit_rate',
        value: cacheHitRate,
        belief: '<(SELF, has_property, low_cache_hit_rate) --> TRUE>.'
      });
    }

    return findings;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
}
