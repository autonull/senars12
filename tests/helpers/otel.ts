/**
 * An in-memory `SpanProcessor` for asserting on emitted telemetry without an
 * exporter. Pass it to `initOtel({ spanProcessors: [collector] })`.
 */
import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-node';

export class CollectingProcessor implements SpanProcessor {
  readonly spans: ReadableSpan[] = [];
  onStart(): void {}
  onEnd(span: ReadableSpan): void {
    this.spans.push(span);
  }
  shutdown(): Promise<void> {
    return Promise.resolve();
  }
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
  findByName(name: string): ReadableSpan | undefined {
    return this.spans.find((s) => s.name === name);
  }
  /** Every `eventName` recorded on the span named `spanName`. */
  eventsOf(spanName: string, eventName: string): Array<Record<string, unknown>> {
    return (this.findByName(spanName)?.events ?? [])
      .filter((event) => event.name === eventName)
      .map((event) => event.attributes as Record<string, unknown>);
  }
  /** Every `eventName` across all spans, whatever span carried it. */
  allEvents(eventName: string): Array<Record<string, unknown>> {
    return this.spans
      .flatMap((span) => span.events)
      .filter((event) => event.name === eventName)
      .map((event) => event.attributes as Record<string, unknown>);
  }
  reset(): void {
    this.spans.length = 0;
  }
}
