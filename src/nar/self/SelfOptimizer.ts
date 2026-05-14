import type {NAR} from '../nar.js';
import type {MetricsCollector} from '../metrics';

export interface Optimization {
    type: string;
    impact: 'high' | 'medium' | 'low';
    action: string;
    reason: string;
}

export interface Optimizations {
    rulePriorities: Array<{ ruleId: string; currentPriority: number; suggestedPriority: number; reason: string }>;
    strategyAdjustments: Array<{ strategy: string; adjustment: string; reason: string }>;
    resourceAllocations: Array<{ resource: string; current: number; suggested: number; reason: string }>;
    performanceImprovements: Optimization[];
}

export class SelfOptimizer {
    private readonly nar: NAR | null;
    private readonly metrics: MetricsCollector | null;
    private optimizationHistory: Optimizations = {
        rulePriorities: [],
        strategyAdjustments: [],
        resourceAllocations: [],
        performanceImprovements: []
    };

    constructor(nar: NAR | null, metrics: MetricsCollector | null) {
        this.nar = nar;
        this.metrics = metrics;
    }

    identifyOptimizations(
        conceptCount: number,
        lowPriorityConcepts: number,
        highPriorityConcepts: number,
        avgRuleExecutionTime: number
    ): Optimizations {
        const optimizations: Optimizations = {
            rulePriorities: [],
            strategyAdjustments: [],
            resourceAllocations: [],
            performanceImprovements: []
        };

        if (conceptCount > 80) {
            optimizations.performanceImprovements.push({
                type: 'memory_cleanup',
                impact: 'high',
                action: 'trigger_consolidation',
                reason: `Concept count (${conceptCount}) exceeds threshold (80)`
            });
        }

        if (lowPriorityConcepts > highPriorityConcepts * 2) {
            optimizations.performanceImprovements.push({
                type: 'priority_rebalancing',
                impact: 'medium',
                action: 'adjust_priorities',
                reason: 'Too many low-priority concepts relative to high-priority'
            });
        }

        if (avgRuleExecutionTime > 50) {
            optimizations.performanceImprovements.push({
                type: 'rule_optimization',
                impact: 'medium',
                action: 'optimize_slow_rules',
                reason: `Average rule execution time (${avgRuleExecutionTime}ms) is high`
            });
        }

        return optimizations;
    }

    async applyOptimizations(optimizations: Optimizations): Promise<void> {
        const handlers = {
            memory_cleanup: () => this.performMemoryCleanup(),
            performance_optimization: () => this.applyPerformanceOptimizations(),
            priority_rebalancing: () => this.rebalancePriorities()
        };

        for (const improvement of optimizations.performanceImprovements) {
            const handler = handlers[improvement.type as keyof typeof handlers];
            if (handler) await handler();
        }
    }

    private async performMemoryCleanup(): Promise<void> {
        this.nar?.memory?.consolidate();
    }

    async applyPerformanceOptimizations(): Promise<void> {
        if (!this.nar) return;

        const metrics = this.metrics?.getSummary();
        if (!metrics) return;

        const config = this.nar.getConfig();
        const {throughput, system} = metrics;
        const throughputValue = throughput?.derivationsPerSecond ?? 0;
        const errorRate = system?.errors && system.totalDerivations ? system.errors / system.totalDerivations : 0;
        const memoryUsage = process.memoryUsage?.().heapUsed ?? 0;
        const conceptCount = this.nar.listConcepts().length;

        if (throughputValue < 10 && config.maxDerivationsPerStep > 50) {
            this.nar.setConfig({...config, maxDerivationsPerStep: Math.max(50, config.maxDerivationsPerStep - 10)});
        }

        if (errorRate > 0.1 && config.priorityThreshold < 0.7) {
            this.nar.setConfig({...config, priorityThreshold: Math.min(0.7, config.priorityThreshold + 0.05)});
        }

        if (memoryUsage > 100000000 || conceptCount > config.maxConcepts! * 0.9) {
            this.nar.memory?.consolidate();
        }

        const concepts = this.nar.listConcepts();
        const lowPriorityConcepts = concepts.filter(c => c.priority < 0.2);
        if (lowPriorityConcepts.length > concepts.length * 0.5) {
            this.nar.setConfig({...config, priorityThreshold: Math.max(0.1, config.priorityThreshold! - 0.05)});
        }
    }

    async rebalancePriorities(): Promise<void> {
        if (!this.nar) return;

        for (const concept of this.nar.listConcepts()) {
            if (concept.priority < 0.1 && concept.totalTasks === 0) {
                concept.priority = Math.min(concept.priority + 0.05, 0.15);
            }
        }
    }

    getOptimizationHistory(): Optimizations {
        return this.optimizationHistory;
    }

    trackOptimization(optimizations: Optimizations): void {
        this.optimizationHistory.performanceImprovements.push(...optimizations.performanceImprovements);
        this.optimizationHistory.performanceImprovements =
            this.optimizationHistory.performanceImprovements.slice(-100);
    }
}