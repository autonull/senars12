/**
 * D11 (TODO17b): bounded event logs for kernel gates — drop-oldest rings.
 * Everything that grows has a bound; kernel logs cap at 1000 events.
 */
import { BoundedRing } from '@senars/util/collections';
export const GATE_LOG_CAPACITY = 1000;
/**
 * The kernel gate rings, by the name each is reached under — the one list the
 * registry, the durable ledger and a restore (CORE.19 C4.3) agree on, so a
 * replayed event lands back in the ring it came from.
 */
export const GATE_LOG_KEYS = ['perception', 'action', 'autonomy', 'reward', 'budget'];
/** Bounded append-only gate log: the shared drop-oldest ring at kernel capacity. */
export const gateLog = () => new BoundedRing(GATE_LOG_CAPACITY);
