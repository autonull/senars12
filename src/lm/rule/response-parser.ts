import { errMsg, type TermTruth } from '@senars/util';
import type { Term } from '../../terms';
import { Truth, termParser } from '../../terms';
import type { Truth as TruthType } from '../../terms/impls/Truth.js';
import { parseJsonObject } from '../json.js';

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
  truth?: TermTruth;
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

/**
 * The last step both structured paths share: a `narsese` payload plus an
 * optional explicit truth becomes a parsed response. `parse` and `validate`
 * differ only in how they obtain the payload — brace-balanced extraction
 * against a strict leading-`{` parse — and disagreed about what to do once
 * they had one, so the resolution lived twice and would have drifted.
 *
 * `confidence` is carried only on the success path; an invalid response reports
 * the parse error and nothing else.
 */
const fromStructured = (
  narsese: string,
  explicitTruth: TermTruth | undefined,
  raw: string,
  confidence?: number
): ParsedLMResponse => {
  try {
    const { term, truth } = termParser.parseWithTruth(narsese);
    return {
      term,
      truth: explicitTruth
        ? Truth.create(explicitTruth.f, explicitTruth.c)
        : (truth ?? Truth.NEUTRAL),
      confidence,
      raw,
      valid: true,
    };
  } catch (error) {
    return invalid(raw, errMsg(error));
  }
};

function extractStructuredOutput(response: string): StructuredLMOutput | null {
  const parsed = parseJsonObject(response) as StructuredLMOutput | null;
  return parsed && typeof parsed.narsese === 'string' ? parsed : null;
}

export const LMResponseParser = {
  parse(response: string): ParsedLMResponse {
    if (!response || response.trim() === '') return invalid(response, 'Empty response');
    const structured = extractStructuredOutput(response);
    if (structured) {
      return fromStructured(structured.narsese, structured.truth, response, structured.confidence);
    }
    return parseNarseseWithTruth(response.trim(), response);
  },

  validate(response: string): ParsedLMResponse {
    if (!response || response.trim() === '') return invalid(response, 'Empty response');
    const trimmed = response.trim();
    if (trimmed.startsWith('{')) {
      let parsed: { narsese?: unknown; truth?: TermTruth };
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return invalid(response, 'Invalid JSON in response');
      }
      if (typeof parsed.narsese !== 'string')
        return invalid(response, 'Missing narsese field in JSON');
      return fromStructured(parsed.narsese, parsed.truth, response);
    }
    return parseNarseseWithTruth(trimmed, response);
  },
};
