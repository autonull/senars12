import type {Term} from '../terms';
import {termParser, Truth} from '../terms';
import {errMsg} from '../utils';

export interface ParsedLMResponse {
    term: Term;
    truth: Truth;
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

export const LMResponseParser = {
    parse(response: string): ParsedLMResponse {
        if (!response || response.trim() === '') {
            return {
                term: termParser.parse('TRUE'),
                truth: Truth.NEUTRAL,
                valid: false,
                raw: response,
                error: 'Empty response'
            };
        }
        try {
            const structured = extractStructuredOutput(response);
            if (structured) {
                const {term, truth} = termParser.parseWithTruth(structured.narsese);
                const finalTruth = structured.truth
                    ? Truth.create(structured.truth.f, structured.truth.c)
                    : (truth ?? Truth.NEUTRAL);
                return {term, truth: finalTruth, confidence: structured.confidence, raw: response, valid: true};
            }
            const plainText = response.trim();
            const {term, truth} = termParser.parseWithTruth(plainText);
            return {term, truth: truth ?? Truth.NEUTRAL, raw: response, valid: true};
        } catch (error) {
            return {
                term: termParser.parse('TRUE'),
                truth: Truth.NEUTRAL,
                valid: false,
                raw: response,
                error: errMsg(error)
            };
        }
    },

    validate(response: string): ParsedLMResponse {
        if (!response || response.trim() === '') {
            return {
                term: termParser.parse('TRUE'),
                truth: Truth.NEUTRAL,
                valid: false,
                raw: response,
                error: 'Empty response'
            };
        }
        const trimmed = response.trim();
        if (trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed.narsese) {
                    const {term, truth} = termParser.parseWithTruth(parsed.narsese);
                    const finalTruth = parsed.truth
                        ? Truth.create(parsed.truth.f, parsed.truth.c)
                        : (truth ?? Truth.NEUTRAL);
                    return {term, truth: finalTruth, raw: response, valid: true};
                }
                return {
                    term: termParser.parse('TRUE'),
                    truth: Truth.NEUTRAL,
                    valid: false,
                    raw: response,
                    error: 'Missing narsese field in JSON'
                };
            } catch {
                return {
                    term: termParser.parse('TRUE'),
                    truth: Truth.NEUTRAL,
                    valid: false,
                    raw: response,
                    error: 'Invalid JSON in response'
                };
            }
        }
        try {
            const {term, truth} = termParser.parseWithTruth(trimmed);
            return {term, truth: truth ?? Truth.NEUTRAL, raw: response, valid: true};
        } catch {
            return {
                term: termParser.parse('TRUE'),
                truth: Truth.NEUTRAL,
                valid: false,
                raw: response,
                error: 'Invalid Narsese syntax'
            };
        }
    },
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
