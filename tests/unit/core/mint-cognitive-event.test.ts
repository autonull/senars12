import {
  type CognitiveEventOf,
  mintCognitiveEvent,
  validateCognitiveEvent,
} from '@senars/core/schemas';
import { describe, expect, it } from 'vitest';

const cycleDraft = () => ({
  engine: 'nar' as const,
  cycle: 7,
  derived: 0,
  payload: { cycle: 7, derived: 0 },
});

describe('mintCognitiveEvent', () => {
  it('stamps a timestamp and a correlation id, so no site has to remember', () => {
    const before = Date.now();
    const event = mintCognitiveEvent('cycle', cycleDraft());
    expect(event.timestamp).toBeGreaterThanOrEqual(before);
    expect(event.correlationId).toBeTruthy();
    expect(event.type).toBe('cycle');
    expect(event.engine).toBe('nar');
  });

  it('honours a supplied timestamp and correlation id', () => {
    const event = mintCognitiveEvent('cycle', {
      ...cycleDraft(),
      timestamp: 1234,
      correlationId: 'given',
    });
    expect(event.timestamp).toBe(1234);
    expect(event.correlationId).toBe('given');
  });

  it('mints a distinct correlation id per event, so two events never share one by accident', () => {
    const ids = new Set(
      Array.from({ length: 50 }, () => mintCognitiveEvent('cycle', cycleDraft()).correlationId)
    );
    expect(ids.size).toBe(50);
  });

  it('carries the variant fields the schema declares, not just the payload', () => {
    const event: CognitiveEventOf<'cycle'> = mintCognitiveEvent('cycle', cycleDraft());
    expect(event.cycle).toBe(7);
    expect(validateCognitiveEvent(event).type).toBe('cycle');
  });

  it('every minted event survives its own validator', () => {
    const events = [
      mintCognitiveEvent('input.user', {
        engine: 'nar',
        payload: { text: 'hello', source: 'cycle' },
      }),
      mintCognitiveEvent('derivation.made', {
        engine: 'nar',
        payload: { rule: 'nal.deduction', premises: ['(a --> b)'], conclusion: '(a ==> b)' },
      }),
      mintCognitiveEvent('judgment.resolved', {
        engine: 'proposer',
        payload: {
          queryId: 'q1',
          shape: 'classify',
          axis: 'epistemic',
          backendId: 'local',
          tier: 1,
          latencyMs: 1,
          abstained: false,
          stampType: 'standard',
          calibrationVersion: 'v1',
          cost: { tokensIn: 1, tokensOut: 1, computeMs: 1, memoryMb: 1 },
        },
      }),
    ];
    for (const event of events) expect(() => validateCognitiveEvent(event)).not.toThrow();
    expect(events.map((e) => e.engine)).toEqual(['nar', 'nar', 'proposer']);
  });

  it('the origin stays the caller-s, so a proposal cannot be logged as a kernel fact', () => {
    const event = mintCognitiveEvent('input.user', {
      engine: 'kernel',
      payload: { text: 'x', source: 'cycle' },
    });
    expect(event.engine).toBe('kernel');
    expect(event.type).not.toBe('proposal.admitted');
  });
});
