import { describe, expect, it, beforeAll } from 'vitest';
import { MettaBackend } from '@senars/metta';
import { clearOps } from '@senars/metta';
import { bootstrapStdLib } from '@senars/metta';
import type { BackendInput } from '@senars/core';

describe('MettaBackend', () => {
  let backend: MettaBackend;

  beforeAll(async () => {
    clearOps();
    bootstrapStdLib();
    backend = new MettaBackend();
    await backend.initialize({});
  });

  it('has correct identity', () => {
    expect(backend.id).toBe('metta');
    expect(backend.label).toBe('MeTTa Pattern Matcher');
    expect(backend.capabilities.has('pattern-match')).toBe(true);
    expect(backend.capabilities.has('rewrite')).toBe(true);
    expect(backend.capabilities.has('query')).toBe(true);
    expect(backend.capabilities.has('skill-execution')).toBe(true);
  });

  it('reports healthy after initialization', () => {
    const h = backend.health();
    expect(h.status).toBe('healthy');
  });

  it('evaluates raw MeTTa expressions', async () => {
    const input: BackendInput = {
      type: 'raw',
      content: '(+ 2 3)',
      correlationId: 'test-1',
    };

    const result = await backend.reason(input);
    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    expect(result.output?.value).toBe('5');
    expect(result.backendId).toBe('metta');
  });

  it('evaluates skill expressions', async () => {
    const input: BackendInput = {
      type: 'skill',
      content: '(+ 10 20)',
      correlationId: 'test-2',
    };

    const result = await backend.reason(input);
    expect(result.success).toBe(true);
    expect(result.output?.value).toBe('30');
  });

  it('returns events and graph delta on evaluation', async () => {
    const input: BackendInput = {
      type: 'raw',
      content: '(* 4 5)',
      correlationId: 'test-3',
    };

    const result = await backend.reason(input);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].engine).toBe('metta');
    expect(result.events[0].type).toBe('derivation');

    expect(result.graphDelta).toBeDefined();
    expect(result.graphDelta?.nodes.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(result.graphDelta?.edges.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it('returns error for unsupported input type', async () => {
    const input: BackendInput = {
      type: 'goal',
      content: 'test',
      correlationId: 'test-4',
    };

    const result = await backend.reason(input);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported input type');
  });

  it('exposes tools via getTools', () => {
    const tools = backend.getTools();
    expect(tools).toHaveLength(3);

    const names = tools.map((t) => t.name);
    expect(names).toContain('metta-match');
    expect(names).toContain('metta-rewrite');
    expect(names).toContain('metta-query');
  });

  it('computes snapshot', () => {
    const snapshot = backend.getSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.backendId).toBe('metta');
    expect(snapshot.capabilities).toContain('pattern-match');
    expect(snapshot.timestamp).toBeGreaterThan(0);
  });

  it('handles chat input type', async () => {
    const input: BackendInput = {
      type: 'chat',
      content: 'hello',
      correlationId: 'test-5',
    };

    const result = await backend.reason(input);
    expect(result.success).toBe(true);
  });
});
