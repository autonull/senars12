import type { ILMService } from '../lm/interfaces.js';
import { type ClarificationResult, ClarificationSchema } from './schemas';
import type { Ambiguity } from './understanding';

export type BotContext = Record<string, unknown>;

export interface ClarificationRequest {
  question: string;
  options: string[];
  ambiguity: Ambiguity;
}

export class ClarificationHandler {
  private pendingClarification: ClarificationRequest | null = null;

  async generateClarification(
    input: string,
    ambiguity: Ambiguity,
    lm: ILMService | null,
    _ctx?: BotContext
  ): Promise<ClarificationRequest | null> {
    if (!lm) {
      return this.fallbackClarification(input, ambiguity);
    }

    try {
      const object = await lm.generateObject(
        `The input "${input}" is ambiguous. Possible interpretations: ${ambiguity.options.join(', ')}. Generate a clarifying question and return the options.`,
        ClarificationSchema
      );

      const request: ClarificationRequest = {
        question: object.question,
        options: object.options,
        ambiguity,
      };

      this.pendingClarification = request;
      return request;
    } catch {
      return this.fallbackClarification(input, ambiguity);
    }
  }

  resolveClarification(userResponse: string): string | null {
    if (!this.pendingClarification) return null;

    const response = userResponse.toLowerCase();
    const option = this.pendingClarification.options.find((o) => {
      const candidate = o.toLowerCase();
      return candidate.includes(response) || response.includes(candidate);
    });

    if (option) {
      this.pendingClarification = null;
      return option;
    }

    return null;
  }

  hasPendingClarification(): boolean {
    return this.pendingClarification !== null;
  }

  getPendingClarification(): ClarificationRequest | null {
    return this.pendingClarification;
  }

  clearPendingClarification(): void {
    this.pendingClarification = null;
  }

  private fallbackClarification(input: string, ambiguity: Ambiguity): ClarificationRequest {
    const request: ClarificationRequest = {
      question: `Your input "${input}" could mean several things. Which did you intend?`,
      options: ambiguity.options,
      ambiguity,
    };
    this.pendingClarification = request;
    return request;
  }
}

export function buildClarificationPrompt(input: string, ambiguity: Ambiguity): string {
  return `The input "${input}" is ambiguous. Interpretations: ${ambiguity.options.join(', ')}. Generate a clarifying question. Return: { "question": "...", "options": ["..."] }`;
}

export async function generateClarificationWithLM(
  input: string,
  ambiguity: Ambiguity,
  lm: ILMService
): Promise<ClarificationResult> {
  return await lm.generateObject(buildClarificationPrompt(input, ambiguity), ClarificationSchema);
}
