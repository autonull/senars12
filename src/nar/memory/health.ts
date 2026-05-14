/**
 * Memory health monitoring
 */
export interface MemoryHealth {
  isHealthy: boolean;
  pressureLevel: number;
  consolidationNeeded: boolean;
  forgettingNeeded: boolean;
  recommendations: string[];
}

export class HealthMonitor {
  private lastCheck = 0;
  private readonly interval: number;

  constructor(config: { healthCheckInterval: number }) {
    this.interval = config.healthCheckInterval;
  }

  shouldCheck(): boolean {
    return Date.now() - this.lastCheck >= this.interval;
  }

  check(conceptCount: number, maxConcepts: number,
    cyclesSinceConsolidation: number, consolidationInterval: number): MemoryHealth {
    const utilization = conceptCount / maxConcepts;
    const consolidationNeeded = cyclesSinceConsolidation >= consolidationInterval;
    const recommendations: string[] = [];

    if (utilization > 0.9) {
      recommendations.push('Memory utilization above 90% - consider increasing capacity or reducing concept count');
    }
    if (consolidationNeeded) {
      recommendations.push('Consolidation overdue - run consolidate() to apply decay and cleanup');
    }
    if (utilization > 0.8) {
      recommendations.push('High memory pressure - forgetting will be triggered on next concept addition');
    }

    return {
      isHealthy: utilization < 0.9 && !consolidationNeeded,
      pressureLevel: utilization,
      consolidationNeeded,
      forgettingNeeded: utilization > 0.8,
      recommendations,
    };
  }

  reset(): void {
    this.lastCheck = 0;
  }
}
