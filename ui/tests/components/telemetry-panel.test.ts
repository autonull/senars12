import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/client/components/views/index.js';
import '../../src/client/components/telemetry-panel.js';
import { $telemetry } from '../../src/client/core/store.js';
import type { ViewHost } from '../../src/client/core/view-host.js';
import type { TelemetryPanel } from '../../src/client/components/telemetry-panel.js';

const sample = {
  reasoning_hz: [1, 2, 3],
  tokens_per_sec: [4, 5, 6],
  memory_mb: [7, 8, 9],
  ws_latency_ms: [1, 1, 1],
};

describe('telemetry panel', () => {
  let el: TelemetryPanel;

  beforeEach(() => {
    el = document.createElement('telemetry-panel') as TelemetryPanel;
    document.body.appendChild(el);
  });

  afterEach(() => el.remove());

  it('renders the chart through the view host', async () => {
    $telemetry.set(sample);
    await el.updateComplete;
    const view = el.shadowRoot?.querySelector('s-view') as ViewHost | null;
    await view?.updateComplete;
    expect(view).toBeTruthy();
    expect(view?.shadowRoot?.querySelector('s-series')).toBeTruthy();
    const legend = view?.shadowRoot?.querySelector('s-series')?.shadowRoot?.querySelectorAll('.legend li');
    expect(legend?.length).toBe(3);
  });

  it('exposes the series through the telemetry test API', async () => {
    $telemetry.set(sample);
    await el.updateComplete;
    const api = (window as { __testApi?: { telemetry?: { getSeries: () => { id: string }[] } } })
      .__testApi?.telemetry;
    expect(api?.getSeries().map((s) => s.id)).toEqual([
      'telemetry.reasoning_hz',
      'telemetry.tokens_per_sec',
      'telemetry.memory_mb',
    ]);
  });
});