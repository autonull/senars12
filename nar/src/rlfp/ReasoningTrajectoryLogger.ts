import { promises as fs } from 'node:fs';
import { errMsg, writeJsonFile } from '@senars/util';
import { type EventBus, OperationError } from '../types';

export interface TrajectoryStep {
  timestamp: number;
  type: string;
  data?: unknown;
}

export interface TrajectoryEventMap extends Record<string, unknown> {
  llm_prompt: { messages: unknown };
  tool_call: { name: string; args: unknown };
  lm_response: { content: unknown };
  lm_failure: { error: string };
}

export class ReasoningTrajectoryLogger {
  private trajectory: TrajectoryStep[] = [];
  private isLogging = false;

  constructor(private eventBus: EventBus<TrajectoryEventMap>) {
    this.setupEventListeners();
  }

  startTrajectory(): void {
    this.trajectory = [];
    this.isLogging = true;
  }

  logStep(type: string, data: unknown): void {
    if (!this.isLogging) return;
    this.trajectory.push({ timestamp: Date.now(), type, data });
  }

  async endTrajectory(filePath?: string): Promise<TrajectoryStep[]> {
    this.isLogging = false;
    if (!filePath) return this.trajectory;

    try {
      await writeJsonFile(filePath, this.trajectory);
    } catch (error) {
      throw new OperationError(`Failed to write trajectory to ${filePath}: ${errMsg(error)}`, {
        filePath,
      });
    }
    return this.trajectory;
  }

  getTrajectory(): TrajectoryStep[] {
    return this.trajectory;
  }

  private setupEventListeners(): void {
    const events: Array<[keyof TrajectoryEventMap & string, string]> = [
      ['llm_prompt', 'llm_prompt'],
      ['tool_call', 'tool_call'],
      ['lm_response', 'lm_response'],
      ['lm_failure', 'lm_failure'],
    ];

    events.forEach(([event, type]) => {
      this.eventBus.on(event, (data) => {
        this.logStep(type, data);
      });
    });
  }
}
