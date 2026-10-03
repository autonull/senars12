import { describe, expect, it } from 'vitest';

import { handleMetricsRequest, recordLmSpend } from '@senars/nar/metrics';

const fakeRes = () => {
  const state = { status: 0, headers: {} as Record<string, string>, body: '' };
  return {
    state,
    res: {
      writeHead(status: number, headers: Record<string, string>) {
        state.status = status;
        Object.assign(state.headers, headers);
      },
      end(body: string) {
        state.body = body;
      },
    } as never,
  };
};

describe('the /metrics endpoint', () => {
  it('serves the Prometheus text exposition for LM spend', async () => {
    recordLmSpend('acme', 120, 3);
    const { state, res } = fakeRes();
    expect(await handleMetricsRequest({ url: '/metrics' } as never, res)).toBe(true);
    expect(state.headers['Content-Type']).toContain('text/plain');
    expect(state.body).toContain('lm_spend_tokens');
    expect(state.body).toContain('acme');
  });

  it('serves JSON at /metrics.json and defers every other path', async () => {
    const { state, res } = fakeRes();
    expect(await handleMetricsRequest({ url: '/metrics.json' } as never, res)).toBe(true);
    expect(Object.keys(JSON.parse(state.body)).length).toBeGreaterThan(0);

    expect(await handleMetricsRequest({ url: '/' } as never, res)).toBe(false);
    expect(await handleMetricsRequest({ url: '/metrics?x=1' } as never, res)).toBe(true);
  });
});
