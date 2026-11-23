/** Shared constants for Dialogue commands. */

export const REACTIONS = ['accept', 'correct', 'reject', 'clarify', 'redirect', 'abandon'] as const;
export const REACTION_SET: ReadonlySet<string> = new Set(REACTIONS);
export const REACTION_USAGE = `.react ${REACTIONS.join('|')} [correction]`;

/** Reactions that count as a negative verification signal for the user channel. */
export const isCorrection = (kind: string): boolean =>
  kind === 'reject' || kind === 'correct' || kind === 'abandon';