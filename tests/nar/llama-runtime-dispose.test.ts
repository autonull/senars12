import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dispose, isLoaded } from '../../nar/src/lm/runtime/llama-runtime.js';

describe('llama-runtime.dispose', () => {
  it('is a no-op when nothing was loaded (arcade runs without the lm arm)', async () => {
    expect(isLoaded()).toBe(false);
    await dispose();
    expect(isLoaded()).toBe(false);
  });

  it('releases native handles instead of dropping references (the post-run hang)', () => {
    const src = readFileSync('nar/src/lm/runtime/llama-runtime.ts', 'utf8');
    expect(src).toContain('context?.dispose()');
    expect(src).toContain('model?.dispose()');
    expect(src).toContain('llama?.dispose()');
  });
});
