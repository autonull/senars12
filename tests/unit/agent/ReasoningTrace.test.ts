import {describe, it, expect, beforeEach} from '@jest/globals';
import {ReasoningTrace} from '../../../src/agent/cognition/ReasoningTrace.js';
import type {Route} from '../../../src/agent/types.js';

describe('ReasoningTrace — Phase 6 cognition', () => {
    let trace: ReasoningTrace;
    const route: Route = {kind: 'nl', confidence: 0.8, signals: [], intent: 'chat', concepts: [], ambiguity: 0};

    beforeEach(() => {
        trace = new ReasoningTrace({now: () => 1_000});
    });

    it('starts empty and records route', () => {
        trace.recordRoute(route);
        expect(trace.steps.length).toBe(1);
        expect(trace.steps[0]?.kind).toBe('route');
    });

    it('records each phase in order', () => {
        trace.recordRoute(route);
        trace.recordPrepareWM(2, {focus: 'X', goal: 'Y'});
        trace.recordAutonomyIncorporate(3);
        trace.recordCompose({
            system: 'sys',
            messages: [],
            tools: {},
            ctxHash: 'h1',
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        });
        trace.recordEvent({kind: 'text-delta', text: 'hello'});
        trace.recordEvent({kind: 'tool-call', call: {toolCallId: 'a', toolName: 'nar_believe', args: {x: 1}}});
        trace.recordEvent({kind: 'tool-result', call: {toolCallId: 'a', toolName: 'nar_believe', args: {x: 1}}, result: {ok: true}});
        trace.recordEvent({kind: 'tool-error', call: {toolCallId: 'b', toolName: 'boom', args: {}}, error: 'kapow'});
        trace.recordReflect({action: 'accept'});
        trace.recordFinalize([], []);
        expect(trace.steps.map(s => s.kind)).toEqual([
            'route', 'prepare-wm', 'autonomy-incorporate', 'compose',
            'text-delta', 'tool-call', 'tool-result', 'tool-error',
            'reflect', 'finalize',
        ]);
    });

    it('getEvents() returns chunks for streaming', () => {
        trace.recordRoute(route);
        trace.recordEvent({kind: 'text-delta', text: 'hi'});
        const events = trace.getEvents();
        expect(events.some(e => e.type === 'reasoning' && e.content.includes('route'))).toBe(true);
        expect(events.some(e => e.type === 'text' && e.content === 'hi')).toBe(true);
    });

    it('toMarkdown() renders the full trace', () => {
        trace.recordRoute(route);
        const md = trace.toMarkdown();
        expect(md).toContain('# Reasoning Trace');
        expect(md).toContain('route');
    });

    it('toJSON() serialises steps and startedAt', () => {
        trace.recordRoute(route);
        const json = trace.toJSON();
        expect(json.startedAt).toBe(1_000);
        expect(json.steps.length).toBe(1);
    });
});
