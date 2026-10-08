/**
 * The telemetry datasets, projected once for every surface that shows them. The
 * full panel charts the series and the HUD expansion renders the same data as a
 * sparkline plus a latest-values table, so both read this instead of re-deriving
 * ranges, colors and formatting beside each renderer (DRY).
 */

import type { TelemetryData } from '../core/store.js';
import type { SeriesDatum, TableDataset } from '../core/view-spec.js';
import { fieldKey, fieldMeta, formatField, TELEMETRY_FIELDS } from './field-catalog.js';
import { theme } from './theme.js';

export type TelemetryRange = '1m' | '5m' | '15m' | '1h';

export const TELEMETRY_RANGE_POINTS: Record<TelemetryRange, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
};

export const TELEMETRY_RANGES = Object.keys(TELEMETRY_RANGE_POINTS) as TelemetryRange[];

export const TELEMETRY_METRIC_KEYS = TELEMETRY_FIELDS.map((id) => fieldKey(id));

export const DEFAULT_TELEMETRY_METRICS = ['reasoning_hz', 'tokens_per_sec', 'memory_mb'];

/** Telemetry data carries one array per field key; index it by key here once. */
const metricValues = (data: TelemetryData, key: string): number[] | undefined =>
  (data as unknown as Record<string, number[] | undefined>)[key];

const slice = (values: number[] | undefined, points: number): number[] =>
  !values ? [] : values.length > points ? values.slice(-points) : values;

/** The charted metrics, in field-catalog order, sliced to the selected range. */
export function telemetrySeries(
  data: TelemetryData,
  metrics: Iterable<string>,
  range: TelemetryRange
): SeriesDatum[] {
  const visible = new Set(metrics);
  const points = TELEMETRY_RANGE_POINTS[range];
  return TELEMETRY_FIELDS.filter((id) => visible.has(fieldKey(id))).map((id) => {
    const meta = fieldMeta(id);
    return {
      id,
      label: meta.short ?? meta.label,
      color: theme.colors[meta.color ?? 'info'],
      values: slice(metricValues(data, fieldKey(id)), points),
    };
  });
}

/** One row per metric holding its latest formatted value. */
export function telemetrySnapshot(data: TelemetryData, metrics: Iterable<string>): TableDataset {
  const visible = new Set(metrics);
  const rows = TELEMETRY_FIELDS.filter((id) => visible.has(fieldKey(id))).map((id) => {
    const values = metricValues(data, fieldKey(id));
    return {
      metric: fieldMeta(id).label,
      value: formatField(id, values?.length ? values[values.length - 1] : undefined),
    };
  });
  return {
    kind: 'table',
    columns: [
      { id: 'metric', label: 'Metric' },
      { id: 'value', label: 'Value' },
    ],
    rows,
  };
}
