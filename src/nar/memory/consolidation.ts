import type { Concept } from './concept.js';
import { Memory } from './memory.js';

export interface ConsolidationConfig {
    healthCheckInterval: number;
    decayRate: number;
    consolidationThreshold: number;
}

const DEFAULT_CONFIG: ConsolidationConfig = {
    healthCheckInterval: 100,
    decayRate: 0.01,
    consolidationThreshold: 0.5
};

export class MemoryConsolidation {
    private config: ConsolidationConfig;
    private lastHealthCheck: number;
    private consolidationCount: number;

    constructor(config: ConsolidationConfig = DEFAULT_CONFIG) {
        this.config = config;
        this.lastHealthCheck = 0;
        this.consolidationCount = 0;
    }

    checkHealth(memory: Memory): void {
        const now = Date.now();
        if (now - this.lastHealthCheck >= this.config.healthCheckInterval * 1000) {
            this.consolidate(memory);
            this.lastHealthCheck = now;
        }
    }

    consolidate(memory: Memory): void {
        this.consolidationCount++;
    }

    get stats(): {
        consolidationCount: number;
        lastHealthCheck: number;
    } {
        return {
            consolidationCount: this.consolidationCount,
            lastHealthCheck: this.lastHealthCheck
        };
    }

    reset(): void {
        this.consolidationCount = 0;
        this.lastHealthCheck = 0;
    }
}

export const memoryConsolidation = new MemoryConsolidation();
