import type { LanguageModel } from 'ai';
import { generateObject, generateText, zodSchema } from 'ai';
import type { ZodSchema } from 'zod';
import type { SeNARSRegistry } from '../lm';
import { getModelForTask } from '../lm';
import { errMsg } from '../utils';
import type { TranslationCache, TranslationCacheEntry } from './cache.js';
import { buildUnderstandingPrompt } from './prompts/understanding-v1.js';
import { TaskBatchSchema } from './schemas.js';

export interface Ambiguity {
  type: 'parse' | 'intent' | 'term' | 'reference';
  description: string;
  options: string[];
  confidence: number;
}

export interface Coreference {
  pronoun: string;
  antecedent: string;
  confidence: number;
}

export interface TaskBatch {
  beliefs: Array<{
    narsese: string;
    truth?: { f: number; c: number };
    source: 'user' | 'inferred';
  }>;
  questions: Array<{ narsese: string; context?: string }>;
  goals: Array<{ narsese: string; priority?: number }>;
  meta: {
    detectedIntent: 'chat' | 'command' | 'reasoning' | 'learning';
    ambiguities: Ambiguity[];
    coreferences: Coreference[];
    implicitContext: string[];
    driveModulations?: Record<string, number>;
  };
}

export interface NLContext {
  beliefs?: string[];
  recentDerivations?: string[];
  memoryHealth?: { pressure: number; totalConcepts: number };
  activeGoals?: string[];
  recentExamples?: TranslationCacheEntry[];
}

function validateNarsese(text: string): boolean {
  if (!text) return false;
  const cleaned = text.replace(/^`+|`+$/g, '').trim();
  if (!cleaned) return false;
  try {
    const { termParser } = require('../terms');
    termParser.parse(cleaned);
    return true;
  } catch {
    return false;
  }
}

export class NLUnderstandingService {
  private readonly model: LanguageModel;
  private structuredOnly: boolean;

  constructor(
    registry: SeNARSRegistry,
    _cache: TranslationCache,
    opts?: { structuredOnly?: boolean }
  ) {
    this.model = getModelForTask(registry, 'structured') as LanguageModel;
    this.structuredOnly = opts?.structuredOnly ?? true;
  }

  async understand(input: string, ctx?: NLContext, maxRetries = 2): Promise<TaskBatch | null> {
    let lastError: string | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.translateWithLM(input, ctx, lastError);
        if (result) {
          return result;
        }
        lastError = 'No valid output produced';
      } catch (e) {
        lastError = errMsg(e);
      }
    }

    return null;
  }

  private async translateWithLM(
    input: string,
    ctx?: NLContext,
    lastError?: string | null
  ): Promise<TaskBatch | null> {
    if (!this.model) return null;

    const prompt = buildUnderstandingPrompt(input, {
      beliefs: ctx?.beliefs,
      recentExamples: ctx?.recentExamples,
      lastError,
      memorySnapshot: ctx?.memoryHealth
        ? `Memory: ${ctx.memoryHealth.totalConcepts} concepts, pressure ${(ctx.memoryHealth.pressure * 100).toFixed(0)}%`
        : undefined,
    });

    try {
      const result = await generateObject({
        model: this.model,
        prompt,
        schema: zodSchema(TaskBatchSchema as ZodSchema<TaskBatch>),
      });
      return result.object as TaskBatch;
    } catch {
      try {
        const textResult = await generateText({
          model: this.model,
          prompt: prompt + '\n\nRespond with valid JSON only.',
        });
        const jsonMatch = textResult.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as TaskBatch;
        }
      } catch {
        try {
          const textResult = await generateText({
            model: this.model,
            prompt: prompt + '\n\nRespond with Narsese statements only.',
          });
          return this.extractNarseseFromText(textResult.text, input);
        } catch {
          return null;
        }
      }
    }

    return null;
  }

  private extractNarseseFromText(text: string, input: string): TaskBatch {
    const beliefs: Array<{
      narsese: string;
      truth?: { f: number; c: number };
      source: 'user' | 'inferred';
    }> = [];
    const questions: Array<{ narsese: string; context?: string }> = [];
    const goals: Array<{ narsese: string; priority?: number }> = [];

    const narsesePattern = /[\(<][^\)>]*[\)>]/g;
    const matches = text.match(narsesePattern) ?? [];

    for (const match of matches) {
      if (validateNarsese(match)) {
        if (match.startsWith('?')) {
          questions.push({ narsese: match, context: input });
        } else if (match.startsWith('!')) {
          goals.push({ narsese: match, priority: 0.5 });
        } else {
          beliefs.push({ narsese: match, source: 'user' });
        }
      }
    }

    return {
      beliefs,
      questions,
      goals,
      meta: {
        detectedIntent: 'learning',
        ambiguities: [],
        coreferences: [],
        implicitContext: [],
      },
    };
  }
}
