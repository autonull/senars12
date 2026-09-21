/**
 * D11 (TODO17b): bounded event logs for kernel gates — drop-oldest rings.
 * Everything that grows has a bound; kernel logs cap at 1000 events.
 */
export const GATE_LOG_CAPACITY = 1000;

export function pushBounded<T>(log: T[], event: T, capacity = GATE_LOG_CAPACITY): void {
  log.push(event);
  if (log.length > capacity) log.splice(0, log.length - capacity);
}
