export type EngineId = string;

export interface CognitiveStimulus {
  text: string;
  source: string;
  timestamp: number;
  correlationId: string;
}

export interface Context {
  working: unknown[];
  episodic: unknown[];
  semantic: unknown[];
}

export interface Derivation {
  term: string;
  truth?: { frequency: number; confidence: number };
  timestamp: number;
}

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
