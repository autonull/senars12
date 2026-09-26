import type { PromptBuilder } from '@senars/core';
import type { CortexSynthesizeRequest } from '@senars/core/cortex';

const buildFn = (req: CortexSynthesizeRequest & { workingMemory: unknown[] }): string => {
  void req;
  return 'x';
};

export const a: PromptBuilder = { build: buildFn };
export const b: PromptBuilder = { build: buildFn };
