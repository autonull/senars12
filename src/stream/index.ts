/**
 * The LM batching queue: provisional beliefs, batched requests, backpressure.
 *
 * The *inference* pipeline that used to live here (`createPipeline`, the
 * `PremiseSource` classes, `derive`) is gone. It was a second inference path
 * that ignored the strategy slots entirely — it sampled memory directly and its
 * `strategy` parameter was never read — so `NARExecution.runStream` now goes
 * through the one `InferenceController`, which honours the configured
 * strategies. Only the LM queue, which has no counterpart elsewhere, remains.
 */
export type { LMBackend, LMRequest, ProvisionalBelief, StreamReasonerOptions } from './reasoner.js';
export { StreamReasoner } from './reasoner.js';
