/**
 * CognitiveController - Internal cognitive orchestration
 *
 * Migrated from: src/nar/cognitive/controller.ts
 * This is an internal implementation detail - not exported publicly
 */

import type {NAR} from '../../nar/nar.js';
import {ObserverService} from './ObserverService.js';

export interface CognitiveControllerConfig {
  enableObservation?: boolean;
  observationInterval?: number;
}

export class CognitiveController {
  private readonly nar: NAR;
  private readonly observer: ObserverService;
  private config: Required<CognitiveControllerConfig>;
  private isRunning = false;
  private observationIntervalId?: NodeJS.Timeout;

  constructor(nar: NAR, config: CognitiveControllerConfig = {}) {
    this.nar = nar;
    this.observer = new ObserverService();
    this.config = { enableObservation: true, observationInterval: 5000, ...config };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    if (this.config.enableObservation) {
      this.startObservationCycle();
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observationIntervalId) {
      clearInterval(this.observationIntervalId);
      this.observationIntervalId = undefined;
    }
  }

  private startObservationCycle(): void {
    this.observationIntervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.observer.runCycle(this.nar);
      }
    }, this.config.observationInterval);
  }

  async runObservationCycle(): Promise<void> {
    await this.observer.runCycle(this.nar);
  }

  getObserver(): ObserverService {
    return this.observer;
  }
}
