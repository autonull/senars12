import type { PromptBuilder } from '@senars/core';
export const a: PromptBuilder = {
  build: (req: { stimulus: unknown; workingMemory: unknown[] }) => {
    void req;
    return 'x';
  },
};
export const b: PromptBuilder = (req: { stimulus: unknown; workingMemory: unknown[] }) => {
  void req;
  return 'x';
};
