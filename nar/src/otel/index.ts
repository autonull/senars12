import { SpanKind, SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api';
import { registerLogEnricher } from '@senars/core';
import { setDomainEventSink } from '@senars/core/event-sink';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { CognitiveEvent, TickContext } from '../tick/tick.js';
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

export function initOtel(config: OtelConfig = {}): void {
  if (initialized) return;
  const {
    serviceName = 'senars-cognitive-kernel',
    otlpEndpoint,
    batch = true,
    enabled = true,
    spanProcessors: extraProcessors = [],
  } = config;
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
  initialized = true;
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

/** O1 helper: run `fn` inside an active span; attributes settable via the handle. */
export function withSpan<T>(
  name: string,
  attributes: Attributes = {},
  fn: (span: Span) => T
): T {
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

const COGNITIVE_STAGES = [
  'perceive',
  'recall',
  'attend',
  'reason',
  'propose',
  'negotiate',
  'authorize',
  'act',
  'validate',
  'learn',
  'consolidate',
] as const;

type CognitiveStage = (typeof COGNITIVE_STAGES)[number];

export function wrapMiddlewareWithSpan(
  stage: CognitiveStage,
  middleware: (ctx: TickContext, next: () => Promise<void>) => Promise<void>
) {
  const tracer = getTracer('senars.cognitive-tick');
  return async (ctx: TickContext, next: () => Promise<void>) => {
    return tracer.startActiveSpan(
      `cognitive.${stage}`,
      { kind: SpanKind.INTERNAL },
      async (span) => {
        const start = Date.now();
        span.setAttribute('tick.id', ctx.tickId);
        span.setAttribute('cognitive.stage', stage);
        span.setAttribute('cognitive.budget.cycles', ctx.budget.cycles);
        if (ctx.budget.depth) span.setAttribute('cognitive.budget.depth', ctx.budget.depth);
        try {
          await middleware(ctx, next);
          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: errMsg(error),
          });
          span.recordException(error as Error);
          throw error;
        } finally {
          const duration = Date.now() - start;
          span.setAttribute('cognitive.duration_ms', duration);
          span.end();
        }
      }
    );
  };
}

export function instrumentPipeline(
  pipeline: Array<(ctx: TickContext, next: () => Promise<void>) => Promise<void>>
): Array<(ctx: TickContext, next: () => Promise<void>) => Promise<void>> {
  return pipeline.map((mw, i) => wrapMiddlewareWithSpan(COGNITIVE_STAGES[i] as CognitiveStage, mw));
}

/**
 * The one event emitter. A nested payload is flattened into dotted attribute
 * names, so `{ consumed: { memoryOps: 1 } }` under the prefix `budget.slice`
 * arrives as `budget.slice.consumed.memoryOps`. `prefix` carries no trailing
 * dot; pass `''` for an unprefixed payload. A key present with value
 * `undefined` is dropped rather than emitted as `''` or `0` — an absent parent
 * id is absent.
 */
export function emitEvent(
  name: string,
  prefix: string,
  payload: Record<string, unknown>
): void {
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

export function emitSpanEvent(
  ctx: TickContext,
  name: string,
  attributes: Record<string, unknown> = {}
): void {
  emitEvent(name, '', { 'tick.id': ctx.tickId, ...attributes });
}

export function recordCognitiveEvents(ctx: TickContext): void {
  if (!ctx.events.length) return;
  for (const event of ctx.events) {
    emitEvent(event.stage, '', {
      'tick.id': ctx.tickId,
      'event.stage': event.stage,
      'event.detail': event.detail ?? '',
      'event.at': event.at,
    });
  }
}

export async function shutdownOtel(): Promise<void> {
  if (provider) {
    await provider.shutdown();
    provider = null;
    initialized = false;
  }
}

export type { CognitiveStage };
export { SpanKind, SpanStatusCode };
