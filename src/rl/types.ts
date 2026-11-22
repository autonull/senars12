import type { Game } from '../game/Game';

/** A `Game` that supports episode resets — the contract episode harnesses need. */
export interface EpisodeGame<S = unknown, A = unknown> extends Game<S, A> {
  reset(): void;
}
