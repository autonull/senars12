import {describe, it, expect} from '@jest/globals';
import {dispatchToolCalls} from '../../../src/agent/model/ToolDispatcher.js';

describe('ToolDispatcher', () => {
    it('returns artifacts for a successful tool call', async () => {
        const tools = {echo: {execute: async (args: Record<string, unknown>) => ({ok: true, echoed: args})}};
        const result = await dispatchToolCalls(
            [{toolName: 'echo', toolCallId: 'c1', args: {x: 1}}],
            {tools},
        );
        expect(result.errors).toEqual([]);
        expect(result.artifacts.length).toBe(1);
        expect(result.artifacts[0]?.type).toBe('tool_result');
        expect(result.artifacts[0]?.metadata?.toolName).toBe('echo');
    });

    it('adds belief_added artifact for nar_believe with success=true', async () => {
        const tools = {
            nar_believe: {
                execute: async (args: Record<string, unknown>) => ({
                    success: true,
                    statement: typeof args.statement === 'string' ? args.statement : '',
                }),
            },
        };
        const result = await dispatchToolCalls(
            [{toolName: 'nar_believe', toolCallId: 'b1', args: {statement: '(cat --> animal).'}}],
            {tools},
        );
        const beliefArtifact = result.artifacts.find(a => a.type === 'belief_added');
        expect(beliefArtifact).toBeDefined();
        expect(beliefArtifact?.content).toBe('(cat --> animal).');
    });

    it('surfaces tool-not-found as an error', async () => {
        const result = await dispatchToolCalls(
            [{toolName: 'missing', toolCallId: 'm1', args: {}}],
            {tools: {}},
        );
        expect(result.artifacts).toEqual([]);
        expect(result.errors.length).toBe(1);
        expect(result.errors[0]?.message).toContain('missing');
    });

    it('surfaces tool exceptions as errors', async () => {
        const tools = {boom: {execute: async () => { throw new Error('kapow'); }}};
        const result = await dispatchToolCalls(
            [{toolName: 'boom', toolCallId: 'b1', args: {}}],
            {tools},
        );
        expect(result.errors[0]?.message).toBe('kapow');
        expect(result.artifacts).toEqual([]);
    });

    it('dispatches multiple tool calls in one batch', async () => {
        const tools = {
            a: {execute: async () => 'a-result'},
            b: {execute: async () => 'b-result'},
        };
        const result = await dispatchToolCalls(
            [
                {toolName: 'a', toolCallId: '1', args: {}},
                {toolName: 'b', toolCallId: '2', args: {}},
            ],
            {tools},
        );
        expect(result.artifacts.length).toBe(2);
        expect(result.errors).toEqual([]);
    });

    it('does not add belief_added for nar_believe with success=false', async () => {
        const tools = {nar_believe: {execute: async () => ({success: false, error: 'nope'})}};
        const result = await dispatchToolCalls(
            [{toolName: 'nar_believe', toolCallId: 'x', args: {statement: '(x --> y).'}}],
            {tools},
        );
        expect(result.artifacts.find(a => a.type === 'belief_added')).toBeUndefined();
        expect(result.artifacts.find(a => a.type === 'tool_result')).toBeDefined();
    });
});
