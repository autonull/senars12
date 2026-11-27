/**
 * How the engine is doing. The vocabulary lives here because the durable
 * `health` event validates against it: `Agent.health()` produced a four-way
 * union while the event that records it was `z.string()`, so nothing stopped a
 * third spelling reaching the log and a reader of the log had no way to know
 * which four words were meant.
 */
import { HEALTH_STATUSES } from '../util/health-status';
export { HEALTH_STATUSES };
