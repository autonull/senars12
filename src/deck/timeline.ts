/**
 * Deck Timeline — event timeline visualization.
 */

import type { Stamp } from '@senars/kernel/types';

/** Timeline event. */
export interface TimelineEvent {
  /** Event ID. */
  id: string;
  /** Timestamp. */
  ts: number;
  /** Event type. */
  type: string;
  /** Description. */
  description: string;
  /** Related artifact IDs. */
  artifacts: string[];
  /** Correlation ID. */
  correlationId?: string;
  /** Metadata. */
  metadata: Record<string, unknown>;
}

/** Timeline view config. */
export interface TimelineConfig {
  /** Time window (ms). */
  window: number;
  /** Max events. */
  maxEvents: number;
  /** Group by type. */
  groupByType: boolean;
  /** Show correlations. */
  showCorrelations: boolean;
}

/** Default timeline config. */
export const defaultTimelineConfig: TimelineConfig = {
  window: 3600000, // 1 hour
  maxEvents: 1000,
  groupByType: true,
  showCorrelations: true,
};

/** Timeline renderer. */
export class TimelineRenderer {
  private config: TimelineConfig;

  constructor(config: TimelineConfig = defaultTimelineConfig) {
    this.config = config;
  }

  /** Render timeline as text. */
  render(events: TimelineEvent[]): string {
    const filtered = this.filterEvents(events);
    const grouped = this.config.groupByType ? this.groupByType(filtered) : { all: filtered };

    let output = '';
    output += '╔══════════════════════════════════════════════════════════════╗\n';
    output += '║ TIMELINE                                                    ║\n';
    output += '╠══════════════════════════════════════════════════════════════╣\n';

    for (const [group, groupEvents] of Object.entries(grouped)) {
      if (group !== 'all') {
        output += `║ ${group.toUpperCase()}                                              ║\n`;
      }
      for (const event of groupEvents.slice(-this.config.maxEvents)) {
        output += `║ ${this.formatEvent(event)} ║\n`;
      }
    }

    output += '╚══════════════════════════════════════════════════════════════╝';
    return output;
  }

  /** Render as JSON. */
  renderJSON(events: TimelineEvent[]): string {
    return JSON.stringify(this.filterEvents(events), null, 2);
  }

  /** Filter events by time window. */
  private filterEvents(events: TimelineEvent[]): TimelineEvent[] {
    const now = Date.now();
    return events.filter(e => now - e.ts <= this.config.window);
  }

  /** Group events by type. */
  private groupByType(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
    const groups: Record<string, TimelineEvent[]> = {};
    for (const event of events) {
      const group = groups[event.type] ?? [];
      group.push(event);
      groups[event.type] = group;
    }
    return groups;
  }

  /** Format single event. */
  private formatEvent(event: TimelineEvent): string {
    const time = new Date(event.ts).toISOString().slice(11, 23);
    const artifacts = event.artifacts.length > 0 ? ` [${event.artifacts.join(', ')}]` : '';
    const corr = event.correlationId ? ` @${event.correlationId.slice(0, 8)}` : '';
    return `${time} ${event.type}: ${event.description}${artifacts}${corr}`;
  }
}

/** Create timeline renderer. */
export function createTimelineRenderer(config?: TimelineConfig): TimelineRenderer {
  return new TimelineRenderer(config);
}

/** Event source for timeline. */
export interface TimelineEventSource {
  /** Get events. */
  getEvents(): Promise<TimelineEvent[]>;
  /** Subscribe to new events. */
  subscribe(callback: (event: TimelineEvent) => void): () => void;
}

/** Create event source from log. */
export function createLogEventSource(): TimelineEventSource {
  const subscribers: Array<(event: TimelineEvent) => void> = [];

  return {
    async getEvents(): Promise<TimelineEvent[]> {
      // In real implementation, query log
      return [];
    },
    subscribe(callback) {
      subscribers.push(callback);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    },
  };
}