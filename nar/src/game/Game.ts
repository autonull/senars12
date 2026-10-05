export interface Perception {
  stateId: string;
  features?: Record<string, number>;
  confidence?: number;
  terminal?: boolean;
}

/**
 * The text a perception is embedded under — the features when a game reports
 * them, the state id otherwise.
 *
 * Both embedding consumers were computing this separately and identically, so a
 * game that reports features was embedded under two different keys by two
 * subsystems: the same state, cached twice and read back as two pointers.
 * `stateId` is the fallback because a game without features has nothing finer to
 * say than its own identity.
 */
export const perceptionKey = (perception: Perception): string =>
  JSON.stringify(perception.features ?? perception.stateId);

export interface GameOutcome {
  reward: number;
  terminal: boolean;
  info?: Record<string, unknown>;
}

export interface Game<S = unknown, A = unknown> {
  readonly id: string;
  observe(): Perception;
  state(): S;
  legalActions(state: S): A[];
  step(action: A): GameOutcome;
}

export interface MetaGame<S = unknown, A = unknown> extends Game<S, A> {
  readonly observesFocuses: string[];
  getFocusStepReport(focusId: string): any | null;
}

export interface SelfMetaGame<S = unknown, A = unknown> extends MetaGame<S, A> {
  setFocusWeight(focusId: string, weight: number): void;
  setKnob(knob: string, value: number): void;
  /** P4 (TODO20): batched knob application (coalesced actuation, single validation pass). */
  setKnobs(knobs: Record<string, number>): void;
  disableReflex(focusId: string, reflexId: string): void;
}
