import type { SamplingStrategy } from '../types.js';
import type { Concept, Memory } from '../../memory';
import type { RandomSource } from '../../types/primitives.js';
import { createLogger } from '@senars/core/logger';

const logger = createLogger({ scope: 'WindowedRoulette' });

export interface WindowedRouletteConfig {
  windowSize?: number;
  rng?: RandomSource;
}

/**
 * Windowed-Roulette Sampling Strategy
 * 
 * Implements the HijackBag paradigm: random window over priority-sorted array
 * -> local sort -> roulette within window -> window slides each call.
 * 
 * This provides cheap diversity with locality bias, distinct from global
 * priority-proportional sampling.
 */
export class WindowedRouletteStrategy implements SamplingStrategy {
  readonly metadata = {
    name: 'windowed-roulette',
    description: 'Positional-local roulette sampling within a sliding priority window',
  };
  readonly name = 'windowed-roulette';

  private readonly windowSize: number;
  private readonly rng: RandomSource;

  constructor(config: WindowedRouletteConfig = {}) {
    this.windowSize = config.windowSize ?? 10;
    this.rng = config.rng ?? Math.random;
  }

  sample(memory: Memory, count: number): Concept[] {
    if (count <= 0) return [];
    
    // Get a random window of concepts from memory
    const window = memory.sampleWindow(this.windowSize, this.rng);
    if (window.length === 0) return [];
    
    // Local sort by priority within the window
    window.sort((a, b) => b.priority - a.priority);
    
    // Roulette selection within the window
    const results: Concept[] = [];
    const totalPriority = window.reduce((sum, c) => sum + c.priority, 0);
    
    if (totalPriority <= 0) {
      // Fallback: return first N concepts from window
      return window.slice(0, count);
    }
    
    for (let i = 0; i < count && window.length > 0; i++) {
      let r = this.rng() * totalPriority;
      let selectedIdx = -1;
      
      for (let j = 0; j < window.length; j++) {
        r -= window[j]!.priority;
        if (r <= 0) {
          selectedIdx = j;
          break;
        }
      }
      
      if (selectedIdx >= 0) {
        results.push(window[selectedIdx]!);
        // Remove selected concept from window for next iteration
        window.splice(selectedIdx, 1);
      } else {
        // Fallback to first item
        results.push(window[0]!);
        window.splice(0, 1);
      }
    }
    
    return results;
  }
}

export const createWindowedRouletteStrategy = (config?: WindowedRouletteConfig): SamplingStrategy => {
  return new WindowedRouletteStrategy(config);
};