import { MAPPED_NAR_EVENTS, narEventToCognitive } from '@senars/nar/events/bridge';
import type { CognitiveEvent } from '@senars/util/types/cognitive';
import { describe, expect, it } from 'vitest';
import type { NAREventMap } from '../../../nar/src/types/events.js';

function term(s: string): { toString: () => string } {
  return { toString: () => s };
}

describe('narEventToCognitive', () => {
  it('maps cycle:start to a cycle cognitive event', () => {
    const evt = narEventToCognitive('cycle:start', { cycle: 7, conceptCount: 10 });
    expect(evt).not.toBeNull();
    expect(evt?.type).toBe('cycle');
    expect(evt).toMatchObject({ engine: 'nar', derived: 0, payload: { cycle: 7, derived: 0 } });
  });

  it('maps rule:applied to derivation.made with stringified terms', () => {
    const data: NAREventMap['rule:applied'] = {
      ruleId: 'ded',
      premises: [term('a'), term('b')],
      conclusion: term('c'),
      truth: { frequency: 1, confidence: 0.9 },
      duration: 1,
    };
    const evt = narEventToCognitive('rule:applied', data);
    expect(evt?.type).toBe('derivation.made');
    expect(evt?.payload).toEqual({ rule: 'ded', premises: ['a', 'b'], conclusion: 'c' });
  });

  it('maps concept:created to concept.activated', () => {
    const evt = narEventToCognitive('concept:created', { term: term('x'), priority: 0.8 });
    expect(evt?.type).toBe('concept.activated');
    expect(evt?.payload).toEqual({ term: 'x', priority: 0.8 });
  });

  it('maps concept:removed to belief.retracted', () => {
    const evt = narEventToCognitive('concept:removed', { term: term('y'), reason: 'forgotten' });
    expect(evt?.type).toBe('belief.retracted');
    expect(evt?.payload).toEqual({ term: 'y' });
  });

  it('maps cognitive:state-change to drive.changed', () => {
    const evt = narEventToCognitive('cognitive:state-change', {
      oldState: 'idle',
      newState: 'active',
      action: 'engage',
    });
    expect(evt?.type).toBe('drive.changed');
    expect(evt?.payload).toEqual({ drive: 'cognitive:engage', urgency: 0.5 });
  });

  it('maps tool:call to tool.request', () => {
    const evt = narEventToCognitive('tool:call', {
      type: 'tool',
      name: 'search',
      args: { q: 'x' },
      timestamp: 100,
    });
    expect(evt?.type).toBe('tool.request');
    expect(evt?.payload).toEqual({ toolName: 'search', args: { q: 'x' } });
    expect(evt?.timestamp).toBe(100);
  });

  it('maps tool:result to tool.response with result', () => {
    const evt = narEventToCognitive('tool:result', {
      type: 'tool',
      name: 'search',
      args: {},
      result: 'ok',
      timestamp: 200,
      duration: 5,
    });
    expect(evt?.type).toBe('tool.response');
    expect(evt?.payload).toMatchObject({ toolName: 'search', result: 'ok', durationMs: 5 });
  });

  it('maps tool:error to tool.response with error', () => {
    const evt = narEventToCognitive('tool:error', {
      type: 'tool',
      name: 'search',
      args: {},
      result: 'boom',
      timestamp: 300,
      duration: 7,
    });
    expect(evt?.type).toBe('tool.response');
    expect(evt?.payload).toMatchObject({ toolName: 'search', error: 'boom', durationMs: 7 });
  });

  it('maps lm:start to skill.executed', () => {
    const evt = narEventToCognitive('lm:start', { promptLength: 10, streaming: true });
    expect(evt?.type).toBe('skill.executed');
    expect(evt?.payload).toEqual({ skill: 'lm.generate', args: [], result: '', durationMs: 0 });
  });

  it('returns null for unmapped events', () => {
    expect(narEventToCognitive('cycle:end', { cycle: 1, derivations: 0, duration: 0 })).toBeNull();
    expect(narEventToCognitive('error', { error: new Error('x') })).toBeNull();
  });

  it('honors a custom engine origin', () => {
    const evt = narEventToCognitive('cycle:start', { cycle: 1, conceptCount: 1 }, 'metta');
    expect(evt?.engine).toBe('metta');
  });

  it('every mapped event key produces a non-null cognitive event', () => {
    const samples: Record<keyof NAREventMap, unknown> = {
      'rule:applied': {
        ruleId: 'r',
        premises: [term('a'), term('b')],
        conclusion: term('c'),
        truth: { frequency: 1, confidence: 1 },
        duration: 1,
      },
      'concept:created': { term: term('x'), priority: 0.5 },
      'concept:removed': { term: term('x'), reason: 'evicted' },
      'cognitive:state-change': { oldState: 'a', newState: 'b', action: 'go' },
      'tool:call': { type: 'tool', name: 't', args: {}, timestamp: 1 },
      'tool:result': { type: 'tool', name: 't', args: {}, result: 'r', timestamp: 1, duration: 1 },
      'tool:error': { type: 'tool', name: 't', args: {}, result: 'e', timestamp: 1, duration: 1 },
      'lm:start': { promptLength: 1, streaming: false },
      'cycle:start': { cycle: 1, conceptCount: 1 },
      'memory:pressure': { level: 1, utilization: 0.5 },
      'memory:consolidated': { conceptsRemoved: 1, conceptsArchived: 1 },
      'lm:call': { modelId: 'm', inputTokens: 1, outputTokens: 1, duration: 1 },
      'lm:error': { ruleId: 'r', error: new Error('x'), duration: 1 },
      'cycle:end': { cycle: 1, derivations: 0, duration: 0 },
      error: { error: new Error('x') },
      'nl:analyzed': { input: 'x', analysis: {} as never },
      'nl:translation': { nl: 'x', narsese: 'y', tier: 1 },
      'nl:clarification-needed': { ambiguity: {} as never },
      'nal:derived': {
        premises: [],
        rule: 'r',
        conclusion: 'c',
        truth: { frequency: 1, confidence: 1 },
      },
      'lm:validation-failed': { output: 'x', reason: 'y' },
      'feedback:correction': { original: 'a', corrected: 'b' },
      'turn:start': { input: 'x', passCount: 1 },
      'turn:end': { response: 'x', durationMs: 1 },
      'turn:error': { error: new Error('x'), stage: 's', passCount: 1 },
      'stage:start': { stage: 's', passCount: 1 },
      'stage:end': { stage: 's', durationMs: 1, passCount: 1 },
      'stage:error': { error: new Error('x'), stage: 's', durationMs: 1 },
      'classify:result': { input: 'x', classification: {} },
      'trigger:score': { heuristicScore: 1, lmScore: 1, total: 2, activated: true },
      'reasoning:start': { inputType: 'x', steps: 1 },
      'reasoning:end': { steps: 1, newBeliefs: [] },
      'lm:chunk': { content: 'x', accumulated: 'x' },
      'lm:end': { response: 'x', durationMs: 1 },
      'lm:suggests-reasoning': true,
      'lm-rule:executed': { ruleId: 'r', durationMs: 1, tasksGenerated: 1 },
      'lm-rule:failed': { ruleId: 'r', error: 'e', durationMs: 1 },
      'lm-rule:disabled': { ruleId: 'r' },
      'directive:found': { directive: {} },
      'directive:execute': { directive: {}, success: true },
      'directive:loop-requested': { type: 'x' },
      'loop:pass': { passCount: 1, needsLoopBack: false },
      'tool:register': { name: 't', descriptor: {} },
      'tool:unregister': { name: 't' },
      'tool:init': { name: 't', state: 's' },
      'tool:stop': { name: 't', state: 's' },
      'tool:dispose': { name: 't', state: 's' },
      'conversation:message-added': { message: {}, count: 1 },
      'conversation:artifact-added': { artifact: {}, count: 1 },
      'conversation:belief-pinned': { belief: 'b', count: 1 },
      'conversation:summarized': { summary: 's' },
      'agent:process:start': { input: 'x' },
      'agent:process:complete': { result: {}, durationMs: 1 },
      'agent:suspend': { cycleCount: 1, lastActivity: 1 },
      'agent:resume': { cycleCount: 1, lastActivity: 1 },
      'system:lm.rule:applied': {
        ruleId: 'r',
        ruleName: 'n',
        durationMs: 1,
        output: 'o',
        timestamp: 1,
      },
      'system:lm.rule:skipped': { ruleId: 'r', ruleName: 'n', reason: 'x', timestamp: 1 },
      'system:lm.rule:structured': { ruleId: 'r', schema: 's', output: 'o', timestamp: 1 },
      'system:lm.rule:tool:called': { ruleId: 'r', tool: 't', args: {}, timestamp: 1 },
      'system:lm.rule:tool:result': { ruleId: 'r', tool: 't', result: {}, timestamp: 1 },
      'system:lm.rule:failed': {
        ruleId: 'r',
        ruleName: 'n',
        error: 'e',
        durationMs: 1,
        timestamp: 1,
      },
      'system:lm.rule:circuit:open': { ruleId: 'r', ruleName: 'n', timestamp: 1 },
      'system:lm.rule:circuit:half-open': { ruleId: 'r', ruleName: 'n', timestamp: 1 },
      'system:lm.rule:circuit:closed': { ruleId: 'r', ruleName: 'n', timestamp: 1 },
    };
    for (const key of MAPPED_NAR_EVENTS) {
      const result = narEventToCognitive(key, samples[key] as NAREventMap[keyof NAREventMap]);
      expect(result).not.toBeNull();
      expect((result as CognitiveEvent).engine).toBe('nar');
      expect(typeof (result as CognitiveEvent).correlationId).toBe('string');
    }
  });
});
