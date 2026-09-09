import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { SimpleSpanProcessor, BatchSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace';
import type { TickContext, CognitiveEvent } from '../tick/tick.js';

let provider: NodeTracerProvider | null = null;
let initialized = false;

export interface OtelConfig {
  serviceName?: string;
  otlpEndpoint?: string;
  batch?: boolean;
  enabled?: boolean;
}

export function initOtel(config: OtelConfig = {}): void {
  if (initialized) return;
  const { serviceName = 'senars12-cognitive-kernel', otlpEndpoint, batch = true, enabled = true } = config;
  if (!enabled) {
    initialized = true;
    return;
  }
  const spanProcessors: SpanProcessor[] = [];
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

export function createMiddlewareSpans(): Map<string, { start: number; end: number }> {
  return new Map();
}

const COGNITIVE_STAGES = [
  'perceive', 'recall', 'attend', 'reason', 'propose',
  'negotiate', 'authorize', 'act', 'validate', 'learn', 'consolidate',
] as const;

type CognitiveStage = (typeof COGNITIVE_STAGES)[number];

export function wrapMiddlewareWithSpan(stage: CognitiveStage, middleware: (ctx: TickContext, next: () => Promise<void>) => Promise<void>) {
  const tracer = getTracer('senars12.cognitive-tick');
  return async (ctx: TickContext, next: () => Promise<void>) => {
    return tracer.startActiveSpan(`cognitive.${stage}`, { kind: SpanKind.INTERNAL }, async (span) => {
      const start = Date.now();
      span.setAttribute('tick.id', ctx.tickId);
      span.setAttribute('cognitive.stage', stage);
      span.setAttribute('cognitive.budget.cycles', ctx.budget.cycles);
      if (ctx.budget.depth) span.setAttribute('cognitive.budget.depth', ctx.budget.depth);
      try {
        await middleware(ctx, next);
        span.setStatus({ code: SpanStatusCode.OK });
      } catch (error) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
        span.recordException(error as Error);
        throw error;
      } finally {
        const duration = Date.now() - start;
        span.setAttribute('cognitive.duration_ms', duration);
        span.end();
      }
    });
  };
}

export function instrumentPipeline(pipeline: Array<(ctx: TickContext, next: () => Promise<void>) => Promise<void>>): Array<(ctx: TickContext, next: () => Promise<void>) => Promise<void>> {
  return pipeline.map((mw, i) => wrapMiddlewareWithSpan(COGNITIVE_STAGES[i] as CognitiveStage, mw));
}

export function createOtelTickHooks(): Record<string, (ctx: TickContext) => void | Promise<void>> {
  return {};
}

export function emitSpanEvent(ctx: TickContext, name: string, attributes: Record<string, unknown> = {}): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, { 'tick.id': ctx.tickId, ...attributes });
  }
}

export function recordCognitiveEvents(ctx: TickContext): void {
  const span = trace.getActiveSpan();
  if (!span || !ctx.events.length) return;
  for (const event of ctx.events) {
    span.addEvent(event.stage, {
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

export { SpanStatusCode, SpanKind };
export type { CognitiveStage };