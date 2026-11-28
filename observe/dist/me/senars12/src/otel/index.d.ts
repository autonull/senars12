import { type Attributes, type Span, SpanStatusCode } from '@opentelemetry/api';
import { type SpanProcessor } from '@opentelemetry/sdk-trace';
export interface OtelConfig {
    serviceName?: string;
    otlpEndpoint?: string;
    batch?: boolean;
    enabled?: boolean;
    /** Additional span processors (tests use an in-memory collector). */
    spanProcessors?: SpanProcessor[];
}
export declare function initOtel(config?: OtelConfig): Promise<void>;
/**
 * The tracer this module traces through.
 *
 * It comes from *this module's* provider, not from `trace.getTracer`. The global
 * registration the API exposes is a once-per-process latch: a second
 * `provider.register()` is silently ignored, and a `shutdown()` disables the
 * provider that latch points at permanently. So any second `initOtel` in a
 * process — a second test file, a reconfigure at runtime — left the module
 * tracing through a dead global and every span it emitted went nowhere while
 * `initOtel` reported success. Reading the provider directly makes the tracer
 * follow this module's lifecycle, and the global stays what it is good for:
 * spans emitted by *other* code, which have no other handle on it.
 */
export declare function getTracer(name: string): import("@opentelemetry/api").Tracer;
/** O1 helper: run `fn` inside an active span; attributes settable via the handle. */
export declare function withSpan<T>(name: string, attributes: Attributes | undefined, fn: (span: Span) => T): T;
/**
 * Whether anything will collect a span. A high-frequency caller checks this *before*
 * building the name string and the attributes literal {@link decisionSpan} would discard.
 */
export declare const tracingEnabled: () => boolean;
/** O1/O4 helper: fire-and-forget span for high-frequency decisions (gate verdicts). */
export declare function decisionSpan(name: string, attributes: Attributes): void;
/**
 * The one event emitter. A nested payload is flattened into dotted attribute
 * names, so `{ consumed: { memoryOps: 1 } }` under the prefix `budget.slice`
 * arrives as `budget.slice.consumed.memoryOps`. `prefix` carries no trailing
 * dot; pass `''` for an unprefixed payload. A key present with value
 * `undefined` is dropped rather than emitted as `''` or `0` — an absent parent
 * id is absent.
 */
export declare function emitEvent(name: string, prefix: string, payload: Record<string, unknown>): void;
export declare function shutdownOtel(): Promise<void>;
export { SpanStatusCode };
//# sourceMappingURL=index.d.ts.map