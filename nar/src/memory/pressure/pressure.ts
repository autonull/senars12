/**
 * Memory pressure detection and response
 */
import type {Concept} from '../concept.js';
import type {Memory} from '../memory.js';

export interface PressureConfig {
    enablePressureDetection?: boolean;
    activationDecayRate?: number;
}

export class PressureDetector {
    private readonly decayRate: number;

    constructor(config: PressureConfig = {}) {
        this.decayRate = config.activationDecayRate ?? 0.01;
    }

    detect(utilization: number): { level: number; shouldCompact: boolean; shouldDecay: boolean } {
        return {
            level: utilization,
            shouldCompact: utilization > 0.8,
            shouldDecay: utilization > 0.7,
        };
    }

    respond(memory: Memory, concepts: Iterable<Concept>): void {
        for (const concept of concepts) {
            concept.applyTimeDecay(this.decayRate);
        }
    }
}
