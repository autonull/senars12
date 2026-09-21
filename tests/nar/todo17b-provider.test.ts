import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLlamaCppFetch, MODEL_PLACEHOLDER } from '../../nar/src/lm/providers/llamacpp.js';

/**
 * Bench 39 — Boot-Order Resilience (TODO17b D4)
 * A model probe before llama-server readiness must never be memoized as a
 * failure/placeholder; the provider recovers when the server appears and no
 * placeholder id is ever sent twice to a healthy server.
 */

const okModels = (id: string) =>
  new Response(JSON.stringify({ data: [{ id }] }), { status: 200 });

describe('Bench 39 — Provider Boot-Order Resilience', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('probe failure before server readiness is retried on the next call', async () => {
let probeCalls = 0;
    let chatCalls = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/models')) {
        probeCalls++;
        if (probeCalls <= 2) throw new Error('ECONNREFUSED');
        return okModels('qwen-local');
      }
      chatCalls++;
      return new Response('ok');
    });
    vi.stubGlobal('fetch', fetchMock);

    const llamacppFetch = createLlamaCppFetch();
    const makeInit = (model?: string) =>
      ({
        method: 'POST',
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }] }),
      }) as RequestInit;

    // Before readiness: two requests → two probes (no memoization).
    await llamacppFetch('http://localhost:8080/v1/chat/completions', makeInit());
    await llamacppFetch('http://localhost:8080/v1/chat/completions', makeInit());
    expect(probeCalls).toBeGreaterThanOrEqual(2);
  });

  it('provider recovers when the server appears; alias substituted', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockImplementation(async (input) =>
        String(input).endsWith('/v1/models') ? okModels('qwen-local') : new Response('ok')
      );
    vi.stubGlobal('fetch', fetchMock);

    const llamacppFetch = createLlamaCppFetch();
    const init = {
      method: 'POST',
      body: JSON.stringify({ model: MODEL_PLACEHOLDER, messages: [] }),
    } as RequestInit;

    await llamacppFetch('http://localhost:8080/v1/chat/completions', init); // probe fails
    await llamacppFetch('http://localhost:8080/v1/chat/completions', init); // probe succeeds
    const lastBody = JSON.parse(
      String(fetchMock.mock.calls.at(-1)![1]?.body)
    ) as { model: string };
    expect(lastBody.model).toBe('qwen-local');
  });

  it('a resolved alias is memoized; the placeholder is never re-sent', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input) =>
      String(input).endsWith('/v1/models') ? okModels('qwen-local') : new Response('ok')
    );
    vi.stubGlobal('fetch', fetchMock);

    const llamacppFetch = createLlamaCppFetch();
    const init = {
      method: 'POST',
      body: JSON.stringify({ model: MODEL_PLACEHOLDER, messages: [] }),
    } as RequestInit;
    await llamacppFetch('http://localhost:8080/v1/chat/completions', init);
    const callsAfterFirst = fetchMock.mock.calls.length;
    await llamacppFetch('http://localhost:8080/v1/chat/completions', init);
    // memoized: no extra /v1/models probe, alias stays
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst + 1);
    const lastBody = JSON.parse(
      String(fetchMock.mock.calls.at(-1)![1]?.body)
    ) as { model: string };
    expect(lastBody.model).toBe('qwen-local');
  });
});