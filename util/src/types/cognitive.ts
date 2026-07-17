export type EngineOrigin = 'nar' | 'metta';

export interface CognitiveEventBase {
  readonly engine: EngineOrigin;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly id?: string;
  readonly payload: unknown;
}

export type CognitiveEvent =
  | (CognitiveEventBase & {
      readonly type: 'input.user';
      readonly payload: { text: string; source: string };
    })
  | (CognitiveEventBase & {
      readonly type: 'derivation.made';
      readonly payload: { rule: string; premises: string[]; conclusion: string };
    })
  | (CognitiveEventBase & {
      readonly type: 'atom.derived';
      readonly payload: { atom: string; space: string };
    })
  | (CognitiveEventBase & {
      readonly type: 'atom.retracted';
      readonly payload: { atom: string; space: string };
    })
  | (CognitiveEventBase & {
      readonly type: 'belief.added';
      readonly payload: { term: string; truth: { frequency: number; confidence: number } };
    })
  | (CognitiveEventBase & {
      readonly type: 'belief.retracted';
      readonly payload: { term: string };
    })
  | (CognitiveEventBase & {
      readonly type: 'belief.revised';
      readonly payload: { term: string; oldTruth: { frequency: number; confidence: number }; newTruth: { frequency: number; confidence: number } };
    })
  | (CognitiveEventBase & {
      readonly type: 'drive.changed';
      readonly payload: { drive: string; urgency: number };
    })
  | (CognitiveEventBase & {
      readonly type: 'goal.achieved';
      readonly payload: { goal: string };
    })
  | (CognitiveEventBase & {
      readonly type: 'goal.failed';
      readonly payload: { goal: string; reason: string };
    })
  | (CognitiveEventBase & {
      readonly type: 'concept.activated';
      readonly payload: { term: string; priority: number };
    })
  | (CognitiveEventBase & {
      readonly type: 'skill.executed';
      readonly payload: { skill: string; args: string[]; result: string; durationMs: number };
    })
  | (CognitiveEventBase & {
      readonly type: 'tool.request';
      readonly payload: { toolName: string; args: Record<string, unknown>; timeoutMs?: number };
    })
  | (CognitiveEventBase & {
      readonly type: 'tool.response';
      readonly payload: { requestId: string; toolName: string; result?: unknown; error?: string; durationMs: number };
    })
  | (CognitiveEventBase & {
      readonly type: 'config.set';
      readonly payload: { path: string; value: unknown };
    })
  | (CognitiveEventBase & {
      readonly type: 'config.delete';
      readonly payload: { path: string };
    })
  | (CognitiveEventBase & {
      readonly type: 'config.schema';
      readonly payload: { schema: unknown };
    })
  | (CognitiveEventBase & {
      readonly type: 'kernel.ready';
      readonly payload: { backendIds: string[] };
    })
  | (CognitiveEventBase & {
      readonly type: 'backend.registered';
      readonly payload: { manifest: unknown };
    })
  | (CognitiveEventBase & {
      readonly type: 'bootstrap';
      readonly payload: { beliefs?: string[]; atoms?: { atom: string; space?: string }[]; skills?: { name: string; code: string }[] };
    })
  | (CognitiveEventBase & {
      readonly type: 'cycle';
      readonly cycle: number;
      readonly derived: number;
      readonly payload: { cycle: number; derived: number };
    })
  | (CognitiveEventBase & {
      readonly type: 'health';
      readonly payload: { status: string; cycleCount: number; errorRate: number };
    })
  | (CognitiveEventBase & {
      readonly type: 'conflict:detected';
      readonly payload: { term: string; conflictWith: string };
    });

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

export const isNarEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { engine: 'nar' }> =>
  e.engine === 'nar';

export const isMettaEvent = (
  e: CognitiveEvent
): e is Extract<CognitiveEvent, { engine: 'metta' }> => e.engine === 'metta';

export const isEventType =
  <T extends CognitiveEvent['type']>(type: T) =>
  (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: T }> =>
    e.type === type;
