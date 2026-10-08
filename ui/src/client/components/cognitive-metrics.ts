import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $cognitiveMetrics, BaseComponent, type CognitiveMetricsData, viewSource } from '../core/index.js';
import type { TableDataset, ViewSpec } from '../core/view-spec.js';
import { COGNITIVE_FIELDS, fieldKey, fieldMeta, formatField } from '../utils/field-catalog.js';

/** Project the cognitive-metrics snapshot into the one-row table the view system renders. */
export const metricsTable = (metrics: CognitiveMetricsData | null): TableDataset => {
  if (!metrics) return { kind: 'table', columns: [], rows: [] };
  const values = metrics as unknown as Record<string, unknown>;
  const urgency = metrics.goalUrgencyDistribution;
  const column = (id: string, label: string) => ({ id, label });
  const columns = [
    ...COGNITIVE_FIELDS.map((id) => column(fieldKey(id), fieldMeta(id).label)),
    ...Object.keys(urgency ?? {}).map((key) => column(`urgency.${key}`, `Urgency ${key}`)),
  ];
  const row: Record<string, unknown> = Object.fromEntries(
    COGNITIVE_FIELDS.map((id) => [fieldKey(id), formatField(id, values[fieldKey(id)])])
  );
  for (const [key, value] of Object.entries(urgency ?? {})) row[`urgency.${key}`] = value;
  return { kind: 'table', columns, rows: [row] };
};

/** The cognitive metrics readout — an embedded key-value view over the metrics atom. */
@customElement('cognitive-metrics')
export class CognitiveMetrics extends BaseComponent {
  static override styles = css`
    :host { display: block; border-top: 1px solid var(--colors-semantic-border-subtle); }
  `;
  private readonly spec: ViewSpec = {
    id: 'cognitive-metrics',
    title: 'Cognitive metrics',
    shapes: ['table'],
    source: viewSource($cognitiveMetrics, metricsTable),
  };

  override connectedCallback() {
    super.connectedCallback();
    this.watch($cognitiveMetrics);
  }

  override render() {
    if (!$cognitiveMetrics.get()) return html``;
    return html`<s-view .spec=${this.spec} budget="embedded" .chrome=${false}></s-view>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cognitive-metrics': CognitiveMetrics;
  }
}