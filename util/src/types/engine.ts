import type { CognitiveStimulus, Context, Derivation } from './cognitive.js';

export type EngineId = string;

export interface ToolResult {
  success: boolean;
  content: unknown;
  error?: string;
}

export interface Engine {
  readonly id: EngineId;
  reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
  query(pattern: string): Promise<unknown[]>;
  absorb?(result: ToolResult): void;
  persist?(): Promise<void>;
  load?(): Promise<void>;
}
