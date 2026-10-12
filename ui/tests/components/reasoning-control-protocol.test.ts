import { describe, expect, it } from 'vitest';
import { IncomingFromClient, IncomingFromServer } from '@senars/core';

/** Every control message the client can send. If one is missing, the server drops it silently. */
const CLIENT_MESSAGES = [
  { type: 'reasoning.submit', term: '(cat --> animal).', mode: 'belief' },
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
});
