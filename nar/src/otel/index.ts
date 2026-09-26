import { SpanKind, SpanStatusCode, trace, type Attributes, type Span } from '@opentelemetry/api';
import { registerLogEnricher } from '@senars/core';
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
        message: error instanceof Error ? error.message : String(error),
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

export function createMiddlewareSpans(): Map<string, { start: number; end: number }> {
  return new Map();
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
            message: error instanceof Error ? error.message : String(error),
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

export function createOtelTickHooks(): Record<string, (ctx: TickContext) => void | Promise<void>> {
  return {};
}

export function emitSpanEvent(
  ctx: TickContext,
  name: string,
  attributes: Record<string, unknown> = {}
): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, { 'tick.id': ctx.tickId, ...attributes });
  }
}

/** F1: BudgetSlice operation span events. */
export function emitBudgetSliceCreated(attributes: {
  sliceId: string;
  parentId?: string;
  totalCycles: number;
  totalDepth: number;
  totalMemoryOps: number;
  totalLMCalls: number;
}): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('budget.slice.created', {
      'budget.slice.id': attributes.sliceId,
      'budget.slice.parent_id': attributes.parentId ?? '',
      'budget.slice.total_cycles': attributes.totalCycles,
      'budget.slice.total_depth': attributes.totalDepth,
      'budget.slice.total_memory_ops': attributes.totalMemoryOps,
      'budget.slice.total_llm_calls': attributes.totalLMCalls,
    });
  }
}

export function emitBudgetSliceConsumed(attributes: {
  sliceId: string;
  resource: 'cycles' | 'depth' | 'memoryOps' | 'llmCalls';
  amount: number;
  consumed: number;
  total: number;
  pressure: number;
}): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('budget.slice.consumed', {
      'budget.slice.id': attributes.sliceId,
      'budget.slice.resource': attributes.resource,
      'budget.slice.amount': attributes.amount,
      'budget.slice.consumed': attributes.consumed,
      'budget.slice.total': attributes.total,
      'budget.slice.pressure': attributes.pressure,
    });
  }
}

export function emitBudgetSliceExhausted(attributes: {
  sliceId: string;
  reason: string;
  consumed: Record<string, number>;
  total: Record<string, number>;
}): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('budget.slice.exhausted', {
      'budget.slice.id': attributes.sliceId,
      'budget.slice.reason': attributes.reason,
      'budget.slice.consumed.cycles': attributes.consumed.cycles ?? 0,
      'budget.slice.consumed.depth': attributes.consumed.depth ?? 0,
      'budget.slice.consumed.memory_ops': attributes.consumed.memoryOps ?? 0,
      'budget.slice.consumed.llm_calls': attributes.consumed.llmCalls ?? 0,
      'budget.slice.total.cycles': attributes.total.totalCycles ?? 0,
      'budget.slice.total.depth': attributes.total.totalDepth ?? 0,
      'budget.slice.total.memory_ops': attributes.total.totalMemoryOps ?? 0,
      'budget.slice.total.llm_calls': attributes.total.totalLMCalls ?? 0,
    });
  }
}

export function emitBudgetSliceMerged(attributes: {
  parentId: string;
  childId: string;
  consumed: Record<string, number>;
}): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('budget.slice.merged', {
      'budget.slice.parent_id': attributes.parentId,
      'budget.slice.child_id': attributes.childId,
      'budget.slice.consumed.cycles': attributes.consumed.cycles ?? 0,
      'budget.slice.consumed.depth': attributes.consumed.depth ?? 0,
      'budget.slice.consumed.memory_ops': attributes.consumed.memoryOps ?? 0,
      'budget.slice.consumed.llm_calls': attributes.consumed.llmCalls ?? 0,
    });
  }
}

/** F1: Bag pressure transition span event. */
export function emitBagPressureTransition(attributes: {
  bagId: string;
  pressure: number;
  capacity: number;
  size: number;
  transition: 'normal' | 'high' | 'critical';
}): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('bag.pressure.transition', attributes);
  }
}

/** F1: Backpressure decision span event. */
export function emitBackpressureDecision(attributes: {
  threadId: string;
  allowed: boolean;
  reason: 'budget-exhausted' | 'mailbox-full' | 'ok';
  budgetRemaining: number;
  mailboxSize: number;
  mailboxCapacity: number;
}): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent('thread.backpressure', attributes);
  }
}

/** F1: Strategy selection span event. */
export function emitStrategySelection(attributes: {
  strategyType: 'sampling' | 'premise' | 'derivation' | 'lm-rule' | 'attention';
  strategyName: string;
  context?: Record<string, string | number | boolean>;
}): void {
  const span = trace.getActiveSpan();
  if (span) {
    const flatAttrs: Record<string, string | number | boolean> = {
      'strategy.type': attributes.strategyType,
      'strategy.name': attributes.strategyName,
    };
    if (attributes.context) {
      for (const [key, value] of Object.entries(attributes.context)) {
        flatAttrs[`strategy.context.${key}`] = value;
      }
    }
    span.addEvent('strategy.selection', flatAttrs);
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

export type { CognitiveStage };
export { SpanKind, SpanStatusCode };
