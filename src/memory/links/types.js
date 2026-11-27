/** The forget policies a link layer accepts — one declaration, so the config
 *  surface and the eviction table below cannot admit a policy the other lacks. */
export const LINK_FORGET_POLICIES = ['priority', 'lru', 'fifo', 'random'];
/** Well-known associative-memory layers; any other name registers on demand. */
export const LINK_LAYER = { TERM: 'term', EMBEDDING: 'embedding' };
