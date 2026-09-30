import { errMsg } from '../utils/error.js';
import type { CognitiveStimulus, Context, Derivation } from './cognitive.js';

export type { CognitiveStimulus, Context, Derivation } from './cognitive.js';

export type EngineId = string;

/**
 * The one tool outcome shape. `partial`/`metadata` were `nar`'s additions and
 * `success`/`content`/`error` core's; the union of the two is what both already
 * handled at runtime.
 */
export interface ToolResult {
  success: boolean;
  content: unknown;
  error?: string;
  /** The tool returned usable output alongside its own failure. */
  partial?: boolean;
  metadata?: Record<string, unknown>;
}

/** A successful outcome. */
export const toolOk = (content: unknown, extra?: Partial<ToolResult>): ToolResult => ({
  success: true,
  content,
  ...extra,
});

/** A failed outcome; anything thrown is stringified at this boundary. */
export const toolError = (error: unknown): ToolResult => ({
  success: false,
  content: null,
  error: errMsg(error),
});

export interface Engine {
  readonly id: EngineId;

  reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;

  query(pattern: string): Promise<unknown[]>;

  absorb?(result: ToolResult): void;

  persist?(): Promise<void>;

  load?(): Promise<void>;
}
