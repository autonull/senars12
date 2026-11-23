/** @public One tally of attempts, and the bounded per-key series of them. */
export type { CallTally, CallTallySeriesOptions } from '../tally';
export { CallTallySeries, createCallTally, recordCall } from '../tally';