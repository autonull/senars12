import { createMockLMService } from '@senars/nar';
import { describe, expect, it } from 'vitest';
import { createCompactionPromptBuilder } from '../../../nar/src/agent/compaction.js';

describe('createCompactionPromptBuilder', () => {
  it('returns empty prompt and does not call the LM below the threshold', () => {
    let calls = 0;
    const lm = createMockLMService({ generateTextFn: () => (calls++, 'summary') });
    const b = createCompactionPromptBuilder(lm, { summaryThreshold: 3, maxHistory: 2 });
    expect(b.build({ workingMemory: [{ type: 'chat', payload: 'a' }] } as never)).toBe('');
    expect(calls).toBe(0);
  });

  it('summarizes older entries beyond maxHistory once threshold is reached', async () => {
    let calls = 0;
    const lm = createMockLMService({
      generateTextFn: (prompt: string) => {
        calls++;
        return `summary of ${prompt}`;
      },
    });
    const b = createCompactionPromptBuilder(lm, { summaryThreshold: 3, maxHistory: 2 });
    const working = [1, 2, 3, 4].map((n) => ({ type: 'chat', payload: `turn-${n}` }));
    expect(b.build({ workingMemory: working } as never)).toBe('');
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toBe(1);
    // summary now injected; single in-flight guard prevents duplicate work
    expect(b.build({ workingMemory: working } as never)).toContain('Prior conversation summary:');
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toBe(1);
  });

  it('keeps the previous summary on LM failure', async () => {
    let fail = false;
    const lm = createMockLMService({
      generateTextFn: () => {
        if (fail) throw new Error('offline');
        fail = true;
        return 'first summary';
      },
    });
    const b = createCompactionPromptBuilder(lm, { summaryThreshold: 3, maxHistory: 2 });
    const working = [1, 2, 3, 4].map((n) => ({ type: 'chat', payload: `turn-${n}` }));
    b.build({ workingMemory: working } as never);
    await new Promise((r) => setTimeout(r, 10));
    expect(b.getSummary()).toBe('first summary');
    b.build({ workingMemory: working } as never);
    await new Promise((r) => setTimeout(r, 10));
    expect(b.getSummary()).toBe('first summary');
  });
});
