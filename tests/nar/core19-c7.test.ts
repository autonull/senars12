/**
 * CORE.19 C7.4 — the production reasoning surface.
 *
 * The route is env-guarded, reuses the kernel the transport already binds, and
 * claims its paths even when disabled (no silent fall-through to chat routing).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import {
  createReasoningRoute,
  DEFAULT_ASK_RUNS,
  MAX_ASK_RUNS,
  REASONING_HTTP_ENV,
  type ReasoningHttpEngine,
} from '@senars/nar/metrics';
import { afterEach, describe, expect, it } from 'vitest';

const makeReq = (method: string, url: string, body?: unknown): IncomingMessage =>
  Object.assign(Readable.from(body === undefined ? [] : [JSON.stringify(body)]), {
    method,
    url,
  }) as unknown as IncomingMessage;

interface Captured {
  statusCode: number;
  body: string;
  json: () => unknown;
}

const makeRes = (): { res: ServerResponse; captured: Captured } => {
  const captured: Captured = { statusCode: 0, body: '', json: () => JSON.parse(captured.body) };
  const res = {
    writeHead(code: number) {
      captured.statusCode = code;
      return res;
    },
    end(text: string) {
      captured.body = text;
      return res;
    },
    get writableEnded() {
      return captured.body !== '';
    },
  } as unknown as ServerResponse;
  return { res, captured };
};

const setEnabled = (v: string | undefined) => {
  if (v === undefined) delete process.env[REASONING_HTTP_ENV];
  else process.env[REASONING_HTTP_ENV] = v;
};

afterEach(() => setEnabled(undefined));

describe('CORE.19 C7.4 — reasoning HTTP surface', () => {
  it('claims its paths and 404s when disabled', async () => {
    setEnabled('false');
    const route = createReasoningRoute(() => ({}));
    const { res, captured } = makeRes();
    expect(await route(makeReq('POST', '/reasoning/ask'), res)).toBe(true);
    expect(captured.statusCode).toBe(404);
    expect((captured.json() as { error: { code: string } }).error.code).toBe('DISABLED');
  });

  it('ignores unrelated paths', async () => {
    setEnabled('true');
    const { res, captured } = makeRes();
    expect(await createReasoningRoute(() => ({}))(makeReq('GET', '/health'), res)).toBe(false);
    expect(captured.statusCode).toBe(0);
  });

  it('rejects a non-POST method', async () => {
    setEnabled('true');
    const { res, captured } = makeRes();
    await createReasoningRoute(() => ({ believe: () => undefined }))(
      makeReq('GET', '/reasoning/believe'),
      res
    );
    expect(captured.statusCode).toBe(405);
  });

  it('believes a term through the bound kernel', async () => {
    setEnabled('true');
    const seen: string[] = [];
    const engine: ReasoningHttpEngine = { believe: (term) => seen.push(term) };
    const { res, captured } = makeRes();
    await createReasoningRoute(() => engine)(
      makeReq('POST', '/reasoning/believe', { term: '(cat-->animal).' }),
      res
    );
    expect(seen).toEqual(['(cat-->animal).']);
    expect(captured.statusCode).toBe(200);
    expect((captured.json() as { operation: string }).operation).toBe('believe');
  });

  it('answers a question with its derivation', async () => {
    setEnabled('true');
    const calls: Array<[string, number]> = [];
    const engine: ReasoningHttpEngine = {
      question: () => calls.push(['question', 0]),
      run: (steps) => calls.push(['run', steps]),
      askWithDerivation: async () => ({
        answer: '(cat-->living)',
        truth: { f: 0.9, c: 0.4 },
        derivation: { record: { rule: 'nal.deduction' } },
      }),
    };
    const { res, captured } = makeRes();
    await createReasoningRoute(() => engine)(
      makeReq('POST', '/reasoning/ask', { term: '(cat-->living)?', runs: 3 }),
      res
    );
    expect(calls).toEqual([
      ['question', 0],
      ['run', 3],
    ]);
    const body = captured.json() as {
      answer: { confidence: number; hasDerivation: boolean };
      derivation: { rule: string };
    };
    expect(body.answer.confidence).toBeCloseTo(0.4);
    expect(body.answer.hasDerivation).toBe(true);
    expect(body.derivation.rule).toBe('nal.deduction');
  });

  it('defaults and clamps the ask cycle count', async () => {
    setEnabled('true');
    const runs: number[] = [];
    const engine: ReasoningHttpEngine = {
      question: () => undefined,
      run: (steps) => runs.push(steps),
      askWithDerivation: async () => undefined,
    };
    const route = createReasoningRoute(() => engine);
    await route(makeReq('POST', '/reasoning/ask', { term: '(a-->b)?' }), makeRes().res);
    await route(makeReq('POST', '/reasoning/ask', { term: '(a-->b)?', runs: 1e9 }), makeRes().res);
    expect(runs).toEqual([DEFAULT_ASK_RUNS, MAX_ASK_RUNS]);
  });

  it('rejects a missing term', async () => {
    setEnabled('true');
    const { res, captured } = makeRes();
    await createReasoningRoute(() => ({ believe: () => undefined }))(
      makeReq('POST', '/reasoning/believe', { term: '' }),
      res
    );
    expect(captured.statusCode).toBe(400);
  });

  it('reports no bound kernel', async () => {
    setEnabled('true');
    const { res, captured } = makeRes();
    await createReasoningRoute(() => undefined)(
      makeReq('POST', '/reasoning/ask', { term: '(a-->b)?' }),
      res
    );
    expect(captured.statusCode).toBe(503);
  });
});
