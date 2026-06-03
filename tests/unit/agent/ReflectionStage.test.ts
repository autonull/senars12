import {describe, it, expect} from '@jest/globals';
import {reflect, parseVerdict, applyVerdict} from '../../../src/agent/cognition/ReflectionStage.js';
import {WorkingMemory} from '../../../src/agent/cognition/WorkingMemory.js';
import {ReasoningTrace} from '../../../src/agent/cognition/ReasoningTrace.js';
import type {LMClient} from '../../../src/nar/lm/types.js';
import type {NAR} from '../../../src/nar/nar.js';
import type {ReasoningArtifact} from '../../../src/agent/types.js';

function makeLMClient(text: string): LMClient {
    return {
        provider: 'mock', available: true, model: 'mock',
        async generateText() { return text; },
    };
}

function makeFailingLMClient(message = 'timeout'): LMClient {
    return {
        provider: 'mock', available: true, model: 'mock',
        async generateText() { throw new Error(message); },
    };
}

const trace = new ReasoningTrace();

describe('ReflectionStage — Phase 6 cognition (I8)', () => {
    describe('parseVerdict', () => {
        it('parses an "accept" verdict', () => {
            expect(parseVerdict('{"action":"accept","reasoning":"looks good"}')).toEqual({
                action: 'accept',
                reasoning: 'looks good',
            });
        });

        it('parses a "revise" verdict with statement and truth', () => {
            const v = parseVerdict('{"action":"revise","revisedStatement":"(sky --> green).","revisedTruth":{"frequency":0.9,"confidence":0.8}}');
            expect(v?.action).toBe('revise');
            expect(v?.revisedStatement).toBe('(sky --> green).');
            expect(v?.revisedTruth).toEqual({frequency: 0.9, confidence: 0.8});
        });

        it('parses an "open_question" verdict', () => {
            const v = parseVerdict('I think the answer is uncertain. {"action":"open_question","openQuestion":"is the moon made of cheese?"}');
            expect(v?.action).toBe('open_question');
            expect(v?.openQuestion).toBe('is the moon made of cheese?');
        });

        it('returns undefined for an unknown action', () => {
            expect(parseVerdict('{"action":"unknown"}')).toBeUndefined();
        });

        it('returns undefined for invalid JSON', () => {
            expect(parseVerdict('not json')).toBeUndefined();
        });

        it('returns undefined for empty string', () => {
            expect(parseVerdict('')).toBeUndefined();
        });
    });

    describe('reflect()', () => {
        it('falls back to "accept" when no LM is supplied', async () => {
            const wm = new WorkingMemory();
            const v = await reflect('hi', trace, {workingMemory: wm});
            expect(v.action).toBe('accept');
        });

        it('falls back to "accept" on LM error', async () => {
            const wm = new WorkingMemory();
            const v = await reflect('hi', trace, {lmClient: makeFailingLMClient(), workingMemory: wm});
            expect(v.action).toBe('accept');
        });

        it('parses a "revise" verdict from the LM response', async () => {
            const wm = new WorkingMemory();
            const lm = makeLMClient('{"action":"revise","revisedStatement":"(sky --> green).","revisedTruth":{"frequency":0.9,"confidence":0.8}}');
            const v = await reflect('hi', trace, {lmClient: lm, workingMemory: wm});
            expect(v.action).toBe('revise');
            expect(v.revisedStatement).toBe('(sky --> green).');
        });

        it('parses an "open_question" verdict from the LM response', async () => {
            const wm = new WorkingMemory();
            const lm = makeLMClient('{"action":"open_question","openQuestion":"what colour is the sky at noon?"}');
            const v = await reflect('hi', trace, {lmClient: lm, workingMemory: wm});
            expect(v.action).toBe('open_question');
            expect(v.openQuestion).toBe('what colour is the sky at noon?');
        });
    });

    describe('applyVerdict()', () => {
        it('records a belief_added artifact on revise', () => {
            const wm = new WorkingMemory();
            const sink: ReasoningArtifact[] = [];
            const fakeNar = {input: async () => undefined} as unknown as NAR;
            applyVerdict({action: 'revise', revisedStatement: '(sky --> green).', revisedTruth: {frequency: 0.9, confidence: 0.8}}, {workingMemory: wm, nar: fakeNar}, sink);
            const artifact = sink.find(a => a.type === 'belief_added');
            expect(artifact).toBeDefined();
            expect(artifact?.content).toBe('(sky --> green).');
            expect(artifact?.metadata?.source).toBe('reflection-stage');
        });

        it('appends to open_questions on open_question', () => {
            const wm = new WorkingMemory();
            const sink: ReasoningArtifact[] = [];
            applyVerdict({action: 'open_question', openQuestion: 'why is the sky blue?'}, {workingMemory: wm}, sink);
            expect(wm.get<string[]>('open_questions')).toContain('why is the sky blue?');
            expect(sink[0]?.type).toBe('question_answered');
        });

        it('does nothing on accept', () => {
            const wm = new WorkingMemory();
            const sink: ReasoningArtifact[] = [];
            applyVerdict({action: 'accept'}, {workingMemory: wm}, sink);
            expect(sink).toEqual([]);
            expect(wm.keys()).toEqual([]);
        });
    });
});
