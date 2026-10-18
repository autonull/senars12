/**
 * CORE.19 C7.4 — the HTTP transport serves an injected route (`/metrics`).
 *
 * `io` cannot import `nar`, so the metrics writer is threaded through the
 * connection deps; this asserts the wiring, not the writer.
 */

import { HTTPConnection } from '@senars/io';
import { handleMetricsRequest } from '@senars/nar/metrics';
import { silentLogger } from '@senars/util';
import { afterEach, describe, expect, it } from 'vitest';

const PORT = 53921;

describe('CORE.19 C7.4 — HTTPConnection serves /metrics', () => {
  const connections: HTTPConnection[] = [];
  afterEach(async () => {
    for (const connection of connections.splice(0)) await connection.disconnect();
  });

  it('answers /metrics from the injected route before auth', async () => {
    const connection = new HTTPConnection(
      {
        id: 'http-metrics',
        type: 'http',
        enabled: true,
        config: { name: 'HTTP', port: PORT },
      } as never,
      { emit: () => undefined, logger: silentLogger(), httpRoute: handleMetricsRequest } as never
    );
    connections.push(connection);
    await connection.connect();

    const response = await fetch(`http://localhost:${PORT}/metrics`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect((await response.text()).length).toBeGreaterThan(0);
  });
});
