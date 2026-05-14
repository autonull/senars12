/**
 * Memory pressure detection and response
 */
import type {Concept} from './concept.js';
import type {Memory} from './memory.js';

export interface PressureConfig {
  enablePressureDetection?: boolean;
  pressureThreshold?: number;
  activationDecayRate?: number;
}

export class PressureDetector {
  private readonly threshold: number;
  private readonly decayRate: number;

  constructor(config: PressureConfig = {}) {
    this.threshold = config.pressureThreshold ?? 0.9;
    this.decayRate = config.activationDecayRate ?? 0.01;
  }

  detect(utilization: number): { level: number; shouldCompact: boolean; shouldDecay: boolean } {
    return {
      level: utilization,
      shouldCompact: utilization >= this.threshold,
      shouldDecay: utilization >= this.threshold,
    };
  }

  respond(memory: Memory, concepts: Iterable<Concept>): void {
    for (const concept of concepts) {
      concept.applyTimeDecay(this.decayRate);
    }
  }
}
