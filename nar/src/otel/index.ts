import { type Attributes, type Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { registerLogEnricher } from '@senars/core';
import { setDomainEventSink } from '@senars/core/event-sink';
import { errMsg } from '@senars/util';

let provider: NodeTracerProvider | null = null;
let initialized = false;

export interface OtelConfig {
  serviceName?: string;
  otlpEndpoint?: string;
  batch?: boolean;
  enabled?: boolean;
  /** Additional span processors (tests use an in-memory collector). */
  spanProcessors?: SpanProcessor[];
}

export async function initOtel(config: OtelConfig = {}): Promise<void> {
  const {
    serviceName = 'senars-cognitive-kernel',
    otlpEndpoint,
    batch = true,
    enabled = true,
    spanProcessors: extraProcessors = [],
  } = config;
  if (initialized && extraProcessors.length === 0 && !otlpEndpoint) return;
  if (initialized) await shutdownOtel();
  initialized = true;
  if (!enabled) return;
  registerLogTraceEnricher();
  setDomainEventSink(emitEvent);
  const spanProcessors: SpanProcessor[] = [...extraProcessors];
  if (otlpEndpoint) {
    const exporter = new OTLPTraceExporter({ url: otlpEndpoint });
    const processor = batch
      ? new BatchSpanProcessor({ exporter })
      : new SimpleSpanProcessor({ exporter });
    spanProcessors.push(processor);
  }
  provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }),
    spanProcessors,
  });
  provider.register();
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

/** O1 helper: run `fn` inside an active span; attributes settable via the handle. */
export function withSpan<T>(name: string, attributes: Attributes = {}, fn: (span: Span) => T): T {
  const tracer = getTracer('senars.nar');
  return tracer.startActiveSpan(name, { kind: SpanKind.INTERNAL, attributes }, (span) => {
    const settle = (result: T): T => {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    };
    const fail = (error: unknown): never => {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: errMsg(error),
      });
      span.recordException(error as Error);
      span.end();
      throw error;
    };
    try {
      const result = fn(span);
      if (result instanceof Promise) return result.then(settle, fail) as T;
      return settle(result);
    } catch (error) {
      return fail(error);
    }
  }) as T;
}

/** O1/O4 helper: fire-and-forget span for high-frequency decisions (gate verdicts). */
export function decisionSpan(name: string, attributes: Attributes): void {
  // §5.1 profile: a span per gate verdict is object churn on the hot path when
  // nobody collects — the Noop tracer still pays for creation and attributes.
  if (provider === null) return;
  const tracer = getTracer('senars.nar');
  const span = tracer.startSpan(name, { kind: SpanKind.INTERNAL, attributes });
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/** O2 wiring: JSON log entries gain `traceId`/`spanId` from the active OTel span. */
function registerLogTraceEnricher(): void {
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
export function emitEvent(name: string, prefix: string, payload: Record<string, unknown>): void {
  const span = trace.getActiveSpan();
  if (!span) return;
  const attributes: Attributes = {};
  const visit = (at: string, source: Record<string, unknown>): void => {
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      const path = at ? `${at}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        visit(path, value as Record<string, unknown>);
      } else {
        attributes[path] = value as string | number | boolean;
      }
    }
  };
  visit(prefix, payload);
  span.addEvent(name, attributes);
}

export async function shutdownOtel(): Promise<void> {
  if (provider) {
    await provider.shutdown();
    provider = null;
    initialized = false;
  }
}

export { SpanStatusCode };
