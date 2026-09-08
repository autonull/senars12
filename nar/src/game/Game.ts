export interface Perception {
  stateId: string;
  features?: Record<string, number>;
  confidence?: number;
  terminal?: boolean;
}

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
  disableReflex(focusId: string, reflexId: string): void;
}