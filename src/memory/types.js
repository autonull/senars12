/**
 * How much recent context an utterance is given. One window for both tiers it is
 * read from — the working tier and the episodic tail beside it — because they are
 * assembled into the same prompt: the two were separate `50`s, and only one of
 * them was ever a cap. Episodic recall is context, not an audit log, so the
 * episodic read is bounded to the same window rather than to whatever the log
 * happens to hold.
 */
export const RECALL_WINDOW = 50;
/** Hard ceiling on the working tier; the oldest entry is evicted past it. */
export const WORKING_MEMORY_CAPACITY = 1000;
