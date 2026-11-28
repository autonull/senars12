/**
 * Trace-vocabulary projection for the budget slice events.
 *
 * `BudgetSlice` announces one event per accounting step in two vocabularies: the
 * typed bus the kernel's own subscribers read, and the flat snake_case shape a
 * tracer receives. The mapping is only needed while something is listening —
 * before `initOtel` registers an exporter there is no sink — so the projection
 * is behind `hasDomainEventSink` rather than allocating on every `consume`.
 */
import type { BudgetEventMap } from './budget-events';
/** The trace half of a budget event. A no-op until an exporter registers. */
export declare const announceBudgetTrace: <K extends keyof BudgetEventMap>(event: K, payload: BudgetEventMap[K]) => void;
//# sourceMappingURL=budget-otel.d.ts.map