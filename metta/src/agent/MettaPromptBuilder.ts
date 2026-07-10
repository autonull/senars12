import type { SkillFeedback } from './MettaTypes.js';

export interface PromptContext {
  readonly skills: string;
  readonly skillResults: string;
  readonly history: string;
  readonly time: string;
  readonly systemPrompt: string;
  readonly maxSkillResultsChars: number;
}

export class MettaPromptBuilder {
  #systemPrompt: string;

  constructor(systemPrompt = 'You are a MeTTa-powered cognitive agent.') {
    this.#systemPrompt = systemPrompt;
  }

  build(ctx: PromptContext): string {
    const skillResults = ctx.skillResults.length > ctx.maxSkillResultsChars
      ? ctx.skillResults.slice(0, ctx.maxSkillResultsChars) + '\n... [truncated]'
      : ctx.skillResults;

    return [
      ctx.systemPrompt,
      '',
      'SKILLS:',
      ctx.skills || '  (none registered)',
      '',
      'OUTPUT_FORMAT: Up to 5 lines, no quotes around args:',
      ' toolName1 arg1',
      ' toolName2 arg2',
      '',
      'LAST_SKILL_USE_RESULTS:',
      skillResults || '  (none)',
      '',
      'HISTORY:',
      ctx.history || '  (no history)',
      '',
      `TIME: ${ctx.time}`,
    ].join('\n');
  }

  setSystemPrompt(prompt: string): void {
    this.#systemPrompt = prompt;
  }

  getSystemPrompt(): string {
    return this.#systemPrompt;
  }
}
