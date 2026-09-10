import { describe, expect, it } from 'vitest';
import { NLGenerationService } from '../../nar/src/nl/generation.js';
import type { GenerationInput } from '../../nar/src/nl/generation.js';

const service = () => new NLGenerationService({ languageModel: () => null } as never);

const input = (query: string): GenerationInput => ({
    query, derivation: null, beliefs: [], conflicts: [],
});

describe('todo7: generation single-flight', () => {
  it('null model falls back deterministically; concurrent same-input shares', async () => {
    const svc = service();
    const [a, b] = await Promise.all([svc.generate(input('What is Whiskers?')), svc.generate(input('What is Whiskers?'))]);
    expect(a).toEqual(b);
    expect(a.response).toContain('Whiskers');
    expect(a.confidence).toBe(0.2);
  });
  it('unserializable input falls back to unique key without throwing', async () => {
    const svc = service();
    const circular = input('q') as unknown as Record<string, unknown>;
    circular['self'] = circular;
    const out = await svc.generate(circular as unknown as GenerationInput);
    expect(out.confidence).toBe(0.2);
  });
});
