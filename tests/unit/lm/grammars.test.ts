import { afterEach, describe, expect, it } from 'vitest';
import { loadGrammar } from '@senars/nar/lm/grammars';
import { createLlamaCppFetch, runWithGrammar } from '@senars/nar/lm/providers/llamacpp';

const withCapturingFetch = async (body: unknown, run: (wrapped: typeof fetch) => Promise<void>) => {
  let captured: Record<string, unknown> | undefined;
  const stub: typeof fetch = async (_input, init) => {
    captured = JSON.parse((init?.body as string) ?? '{}');
    return new Response('{}', { status: 200 });
  };
  const saved = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    await run(createLlamaCppFetch());
  } finally {
    globalThis.fetch = saved;
  }
  return captured;
};

describe('GBNF grammar library', () => {
  it('loads both shipped grammars non-empty', () => {
    expect(loadGrammar('narsese-term')).toContain('root');
    expect(loadGrammar('single-word')).toContain('root');
  });

  it('caches repeated loads', () => {
    expect(loadGrammar('narsese-term')).toBe(loadGrammar('narsese-term'));
  });
});

describe('llamacpp fetch wrapper', () => {
  afterEach(() => {
    delete process.env.LM_LLAMACPP_HOST;
  });

  it('passes non-JSON bodies through untouched', async () => {
    let passedThrough = false;
    const saved = globalThis.fetch;
    globalThis.fetch = (async () => {
      passedThrough = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const res = await createLlamaCppFetch()('http://x', { method: 'POST', body: 'not-json' });
      expect(res.status).toBe(200);
    } finally {
      globalThis.fetch = saved;
    }
    expect(passedThrough).toBe(true);
  });

  it('injects the active grammar inside the grammar scope', async () => {
    const captured = await withCapturingFetch({ messages: [] }, (wrapped) =>
      runWithGrammar('root ::= word', () =>
        wrapped('http://x/v1/chat/completions', {
          method: 'POST',
          body: JSON.stringify({ messages: [] }),
        })
      )
    );
    expect(captured?.grammar).toBe('root ::= word');
  });

  it('injects enable_thinking:false chat_template_kwargs when disabled', async () => {
    const saved = globalThis.fetch;
    let captured: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_i, init) => {
      captured = JSON.parse((init?.body as string) ?? '{}');
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      await createLlamaCppFetch({ disableThinking: true })('http://x', {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
      });
    } finally {
      globalThis.fetch = saved;
    }
    expect(captured?.chat_template_kwargs).toEqual({ enable_thinking: false });
  });
});
