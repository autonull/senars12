/**
 * The domain-event sink: the one place a lower layer can announce something
 * without knowing which tracer, logger or transport is listening.
 *
 * `nar`'s otel module registers its exporter here during `initOtel`; until then
 * emission is a no-op, which is the same observable behaviour as a tracer with
 * no provider registered. The alternative — importing the emitter downward — is
 * the layering inversion the sink exists to prevent.
 */
export type DomainEventPayload = Record<string, unknown>;
export type DomainEventSink = (name: string, scope: string, payload: DomainEventPayload) => void;
export declare function setDomainEventSink(next: DomainEventSink | null): void;
export declare function hasDomainEventSink(): boolean;
export declare function emitDomainEvent(name: string, scope: string, payload?: DomainEventPayload): void;
//# sourceMappingURL=event-sink.d.ts.map