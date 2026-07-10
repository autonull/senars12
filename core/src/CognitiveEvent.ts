export type EngineOrigin = 'nar' | 'metta';

export interface CognitiveEventBase {
  readonly engine: EngineOrigin;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly parentEventId?: string;
}

export type CognitiveEvent =
  | (CognitiveEventBase & {
      readonly type: 'derivation';
      readonly term: string;
      readonly confidence: number;
    })
  | (CognitiveEventBase & {
      readonly type: 'cycle';
      readonly cycle: number;
      readonly derived: number;
    })
  | (CognitiveEventBase & {
      readonly type: 'drive:changed';
      readonly drive: string;
      readonly urgency: number;
    })
  | (CognitiveEventBase & { readonly type: 'goal:resolved'; readonly term: string })
  | (CognitiveEventBase & {
      readonly type: 'conflict:detected';
      readonly term: string;
      readonly conflictWith: string;
    })
  | (CognitiveEventBase & {
      readonly type: 'concept:activated';
      readonly term: string;
      readonly priority: number;
    })
  | (CognitiveEventBase & {
      readonly type: 'skill:executed';
      readonly skill: string;
      readonly result: string;
      readonly durationMs: number;
    })
  | (CognitiveEventBase & {
      readonly type: 'input';
      readonly term: string;
      readonly source: string;
    })
  | (CognitiveEventBase & {
      readonly type: 'health';
      readonly status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
      readonly cycleCount: number;
      readonly errorRate: number;
    });

export const isNarEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { engine: 'nar' }> =>
  e.engine === 'nar';
export const isMettaEvent = (
  e: CognitiveEvent
): e is Extract<CognitiveEvent, { engine: 'metta' }> => e.engine === 'metta';
export const isEventType =
  <T extends CognitiveEvent['type']>(type: T) =>
  (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: T }> =>
    e.type === type;

export interface ChatOptions {
  readonly signal?: AbortSignal;
  readonly sessionId?: string;
  readonly stream?: boolean;
}

export interface ChatStreamEvent {
  readonly kind: 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'error' | 'aborted';
  readonly text?: string;
  readonly toolName?: string;
  readonly toolArgs?: unknown;
  readonly toolResult?: unknown;
  readonly error?: string;
}
