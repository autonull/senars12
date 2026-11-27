/**
 * The one value a command returns to mean "the transport should close".
 *
 * A command's result channel is its return value, so exit has to travel back
 * through it — and both the producer (a `nar` command definition) and the
 * consumer (an `io` connection) need to agree on it without either depending on
 * the other, so the contract lives here rather than beside either end.
 */
export const QUIT_SENTINEL = '__CLI_QUIT__';
/** Whether a command result asks the transport to close. */
export const isQuitResult = (result) => result === QUIT_SENTINEL;
