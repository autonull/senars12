import type { Term } from '../../terms';
import { Truth, termParser } from '../../terms';
import type { Truth as TruthType } from '../../terms/truth.js';
import { errMsg } from '../../utils';

export interface ParsedLMResponse {
  term: Term;
  truth: TruthType;
  confidence?: number;
  raw: string;
  valid: boolean;
  error?: string;
}

export interface StructuredLMOutput {
  narsese: string;
  truth?: { f: number; c: number };
  confidence?: number;
}

const invalid = (raw: string, error: string): ParsedLMResponse => ({
  term: termParser.parse('TRUE'),
  truth: Truth.NEUTRAL,
  valid: false,
  raw,
  error,
});

const parseNarseseWithTruth = (text: string, raw: string): ParsedLMResponse => {
  try {
    const { term, truth } = termParser.parseWithTruth(text);
    return { term, truth: truth ?? Truth.NEUTRAL, raw, valid: true };
  } catch {
    return invalid(raw, 'Invalid Narsese syntax');
  }
};

function extractStructuredOutput(response: string): StructuredLMOutput | null {
  const jsonMatch = response.match(/\{[\s\S]*"narsese"\s*:[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

export const LMResponseParser = {
  parse(response: string): ParsedLMResponse {
    if (!response || response.trim() === '') return invalid(response, 'Empty response');
    const structured = extractStructuredOutput(response);
    if (structured) {
      try {
        const { term, truth } = termParser.parseWithTruth(structured.narsese);
        const finalTruth = structured.truth
          ? Truth.create(structured.truth.f, structured.truth.c)
          : (truth ?? Truth.NEUTRAL);
        return {
          term,
          truth: finalTruth,
          confidence: structured.confidence,
          raw: response,
          valid: true,
        };
      } catch (error) {
        return invalid(response, errMsg(error));
      }
    }
    return parseNarseseWithTruth(response.trim(), response);
  },

  validate(response: string): ParsedLMResponse {
    if (!response || response.trim() === '') return invalid(response, 'Empty response');
    const trimmed = response.trim();
    if (trimmed.startsWith('{')) {
      let parsed: { narsese?: unknown; truth?: { f: number; c: number } };
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return invalid(response, 'Invalid JSON in response');
      }
      if (typeof parsed.narsese !== 'string')
        return invalid(response, 'Missing narsese field in JSON');
      try {
        const { term, truth } = termParser.parseWithTruth(parsed.narsese);
        const finalTruth = parsed.truth
          ? Truth.create(parsed.truth.f, parsed.truth.c)
          : (truth ?? Truth.NEUTRAL);
        return { term, truth: finalTruth, raw: response, valid: true };
      } catch (error) {
        return invalid(response, errMsg(error));
      }
    }
    return parseNarseseWithTruth(trimmed, response);
  },
};
