import { describe, expect, it } from 'vitest';
import { IncomingFromClient, IncomingFromServer } from '@senars/core';

/** Every control message the client can send. If one is missing, the server drops it silently. */
const CLIENT_MESSAGES = [
  { type: 'reasoning.submit', term: '(cat --> animal).', mode: 'belief' },
  { type: 'reasoning.ask', term: '(cat --> animal)?' },
  { type: 'reasoning.ask', term: '(cat --> animal)?', runs: 5 },
  { type: 'reasoning.step' },
  { type: 'reasoning.run' },
  { type: 'reasoning.abort' },
  { type: 'reasoning.retract', nodeId: 'n1' },
  { type: 'reasoning.revise', nodeId: 'n1', frequency: 0.5, confidence: 0.5 },
  { type: 'reasoning.add-goal', term: 'goal!' },
  { type: 'reasoning.adjust-budget', budget: 100 },
  { type: 'reasoning.adjust-provider', provider: 'mock' },
] as const;

describe('reasoning control protocol', () => {
  it('accepts every reasoning control message the client sends', () => {
    for (const message of CLIENT_MESSAGES) {
      const parsed = IncomingFromClient.safeParse(message);
      expect(parsed.success, `${message.type} was rejected by IncomingFromClient`).toBe(true);
    }
  });

  it('carries the reasoning control response back to the client', () => {
    const parsed = IncomingFromServer.safeParse({
      type: 'reasoning.control.response',
      ok: true,
      seqId: 3,
    });
    expect(parsed.success).toBe(true);
  });

  it('correlates a control request with its response by seqId', () => {
    const request = IncomingFromClient.safeParse({ type: 'reasoning.run', seqId: 42 });
    expect(request.success).toBe(true);
    expect(request.success && request.data.seqId).toBe(42);

    const response = IncomingFromServer.safeParse({
      type: 'reasoning.control.response',
      ok: true,
      seqId: 42,
    });
    expect(response.success && response.data.seqId).toBe(42);
  });

  it('carries an ask answer (truth + whether a proof exists) on the response', () => {
    const response = IncomingFromServer.safeParse({
      type: 'reasoning.control.response',
      ok: true,
      seqId: 7,
      answer: { answer: '(robin-->animal)', frequency: 1, confidence: 0.9, hasDerivation: true },
    });
    expect(response.success && response.data.answer).toEqual({
      answer: '(robin-->animal)',
      frequency: 1,
      confidence: 0.9,
      hasDerivation: true,
    });
  });
});
