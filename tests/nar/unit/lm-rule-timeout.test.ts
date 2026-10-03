import { describe, expect, it } from 'vitest';

import { LMRule } from '@senars/nar/lm/rule/LMRule';
import type { LMService } from '@senars/nar/lm/lm-service';
import { atom } from '@senars/nar/terms';

const never = <T>(): Promise<T> => new Promise<T>(() => {});

const hung = { tryGenerateText: () => never<string>() } as unknown as LMService;

describe('an LM rule whose provider never answers', () => {
  it('degrades to its symbolic fallback rather than faulting the caller', async () => {
    const rule = new LMRule('lm-hung', hung, {
      name: 'lm-hung',
      promptTemplate: '{{primaryTerm}}',
      singlePremise: true,
      callTimeoutMs: 40,
      fallback: () => null,
    });
    await expect(rule.apply(atom('cat'))).resolves.toEqual([]);
    expect(rule.getStats().stats.failedCalls).toBe(1);
  });
});
