import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, SimpleSpanProcessor, TracerProvider, } from '@opentelemetry/sdk-trace';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { registerLogEnricher, errMsg } from '../util/index';
import { setDomainEventSink } from '../agent/event-sink';
let provider = null;
let initialized = false;
export async function initOtel(config = {}) {
    const { serviceName = 'senars-cognitive-kernel', otlpEndpoint, batch = true, enabled = true, spanProcessors: extraProcessors = [], } = config;
    if (initialized && extraProcessors.length === 0 && !otlpEndpoint)
        return;
    if (initialized)
        await shutdownOtel();
    initialized = true;
    if (!enabled)
        return;
    registerLogTraceEnricher();
    setDomainEventSink(emitEvent);
    const spanProcessors = [...extraProcessors];
    if (otlpEndpoint) {
        const exporter = new OTLPTraceExporter({ url: otlpEndpoint });
        const processor = batch
            ? new BatchSpanProcessor({ exporter })
            : new SimpleSpanProcessor({ exporter });
        spanProcessors.push(processor);
    }
    provider = new TracerProvider({
        resource: resourceFromAttributes({
            [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        }),
        spanProcessors,
    });
    trace.setGlobalTracerProvider(provider);
    // Ensure context propagation works for async operations
    context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
}
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
export function getTracer(name) {
    return provider?.getTracer(name) ?? trace.getTracer(name);
}
/** O1 helper: run `fn` inside an active span; attributes settable via the handle. */
export function withSpan(name, attributes = {}, fn) {
    const tracer = getTracer('senars.nar');
    return tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL, attributes }, (span) => {
        const settle = (result) => {
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            return result;
        };
        const fail = (error) => {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: errMsg(error),
            });
            span.recordException(error);
            span.end();
            throw error;
        };
        try {
            const result = fn(span);
            if (result instanceof Promise)
                return result.then(settle, fail);
            return settle(result);
        }
        catch (error) {
            return fail(error);
        }
    });
}
/**
 * Whether anything will collect a span. A high-frequency caller checks this *before*
 * building the name string and the attributes literal {@link decisionSpan} would discard.
 */
export const tracingEnabled = () => provider !== null;
/** O1/O4 helper: fire-and-forget span for high-frequency decisions (gate verdicts). */
export function decisionSpan(name, attributes) {
    // §5.1 profile: a span per gate verdict is object churn on the hot path when
    // nobody collects — the Noop tracer still pays for creation and attributes.
    if (!tracingEnabled())
        return;
    const tracer = getTracer('senars.nar');
    const span = tracer.startSpan(name, { kind: SpanKind.INTERNAL, attributes });
    span.setStatus({ code: SpanStatusCode.OK });
    span.end();
}
/** O2 wiring: JSON log entries gain `traceId`/`spanId` from the active OTel span. */
function registerLogTraceEnricher() {
    registerLogEnricher(() => {
        const spanContext = trace.getActiveSpan()?.spanContext();
        return spanContext ? { traceId: spanContext.traceId, spanId: spanContext.spanId } : undefined;
    });
}
/**
 * The one event emitter. A nested payload is flattened into dotted attribute
 * names, so `{ consumed: { memoryOps: 1 } }` under the prefix `budget.slice`
 * arrives as `budget.slice.consumed.memoryOps`. `prefix` carries no trailing
 * dot; pass `''` for an unprefixed payload. A key present with value
 * `undefined` is dropped rather than emitted as `''` or `0` — an absent parent
 * id is absent.
 */
export function emitEvent(name, prefix, payload) {
    const span = trace.getActiveSpan();
    if (!span)
        return;
    const attributes = {};
    const visit = (at, source) => {
        for (const [key, value] of Object.entries(source)) {
            if (value === undefined)
                continue;
            const path = at ? `${at}.${key}` : key;
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                visit(path, value);
            }
            else {
                attributes[path] = value;
            }
        }
    };
    visit(prefix, payload);
    span.addEvent(name, attributes);
}
export async function shutdownOtel() {
    const currentProvider = provider;
    if (!currentProvider)
        return;
    provider = null;
    initialized = false;
    try {
        await currentProvider.shutdown();
    }
    catch (e) {
        // Provider already shut down or in invalid state; ignore
    }
}
export { SpanStatusCode };
