/**
 * Event channel taxonomy (B5).
 * All events are emitted on a single NarEventBus but logically grouped by channel prefix.
 * - kernel:*  — system-level: budget, memory, cycle, LM calls, concept lifecycle
 * - cognition:* — reasoning: derivations, drives, self-monitoring, LM rules
 * - ui:*      — user-facing: NL, conversation, tools, agent process
 *
 * Existing event names are retained for parity; migration to prefixed names
 * will happen after golden scenarios are verified (C31).
 */
export const EventChannel = {
    kernel: 'kernel',
    cognition: 'cognition',
    ui: 'ui',
};
import { EventBus } from '../events/event-bus';
/** NAR's event bus, keyed on {@link NAREventMap} (X4: typed bus). */
export class NarEventBus extends EventBus {
    // EventPublisher compatibility — broader signatures for structural compatibility
    emit(event, data) {
        super.emit(event, data);
    }
    on(event, handler) {
        return super.on(event, handler);
    }
    off(event, handler) {
        super.off(event, handler);
    }
}
