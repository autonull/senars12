import type { Perception, GameOutcome } from '../game/Game.js';

export interface ActionProposal {
  action: string;
  args?: Record<string, unknown>;
  value: number;
  confidence: number;
  source: string;
}

export interface LearningEvent {
  perception: Perception;
  previousPerception: Perception | null;
  actionProposed: string;
  actionExecuted: string | null;
  reward: number;
  terminal: boolean;
  overriddenBy: string | null;
}

export interface Reflex<S = unknown, A = unknown> {
  readonly id: string;
  propose(state: S, legalActions: A[]): ActionProposal[];
  learn(event: LearningEvent): void;
}