import type { AgentCapabilities, CognitiveEvent, Connection } from '@senars/core';
import type { MeTTaAtom } from '../types/ast.js';

export interface SkillFeedback {
  readonly skill: string;
  readonly lastResult: string;
  readonly successRate: number;
  readonly callCount: number;
}

export interface MettaLoopConfig {
  readonly maxWakeLoops: number;
  readonly sleepInterval: number;
  readonly wakeupInterval: number;
  readonly skillResultsChars: number;
}

export const DEFAULT_LOOP_CONFIG: MettaLoopConfig = {
  maxWakeLoops: 50,
  sleepInterval: 1,
  wakeupInterval: 600,
  skillResultsChars: 50000,
};

export interface MettaAgentOptions {
  readonly metta?: unknown;
  readonly loopConfig?: Partial<MettaLoopConfig>;
}

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
  readonly lastCycle: number;
  readonly cycleCount: number;
  readonly errorRate: number;
}

export interface PromptContext {
  readonly systemPrompt: string;
  readonly skills: string;
  readonly skillResults: string;
  readonly history: string;
  readonly time: string;
  readonly maxSkillResultsChars: number;
}

export interface MettaAgent {
  start(): void;
  stop(): void;

  submit(input: string, correlationId: string): void;

  on(event: string | '*', handler: (event: CognitiveEvent) => void): void;
  off(event: string | '*', handler: (event: CognitiveEvent) => void): void;

  health(): HealthStatus;
  capabilities(): AgentCapabilities;
  mount(transport: Connection): void;
  unmount(transport: Connection): void;
}
