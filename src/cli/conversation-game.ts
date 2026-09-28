/**
 * Conversation-game reflex access.
 *
 * `NAR.attachConversationGame` returns a `GameFocus` *wrapper*; the reflexes
 * it owns live on the inner `Focus` reached via `getFocus()`. Reading
 * `game.focus.reflexes` type-checks nowhere yet yields `undefined` at runtime,
 * so every reader goes through {@link reflexesOf} instead of walking the shape.
 */

import type { GameFocus, Reflex } from '@senars/nar/focus';

/** What `attachConversationGame` hands back (and what the game registry stores per id). */
export interface AttachedGame {
  readonly focus: GameFocus;
  readonly game?: unknown;
}

/**
 * A reflex plus the policy fields the CLI surfaces. Concrete reflex classes
 * (`ManifoldReflex`, `LMReflex`, …) add these; the base `Reflex` omits them, so
 * the widening happens once here rather than at every read site.
 */
export type ReflexView = Reflex & {
  numArms?: number;
  epsilon?: number;
  budget?: { maxCycles?: number };
  contrastiveVetoes?: number;
  lastDecision?: unknown;
};

/** The reflexes bound to an attached game — empty when nothing is attached. */
export const reflexesOf = (game: AttachedGame | null | undefined): readonly ReflexView[] =>
  (game?.focus.getFocus().reflexes ?? []) as readonly ReflexView[];
