import type {Term} from '../terms';
import {termParser, Truth} from '../terms';

export interface ParsedLMResponse {
    term: Term;
    truth?: Truth;
    confidence?: number;
    raw: string;
    valid: boolean;
    error?: string;
}

export interface StructuredLMOutput {
    narsese: string;
    truth?: {
        f: number;
        c: number;
    };
    confidence?: number;
}

export class LMResponseParser {
    static parse(response: string, defaultTruth?: Truth): ParsedLMResponse {
        if (!response || response.trim() === '') {
            return {
                term: termParser.parse('TRUE'),
                truth: defaultTruth,
                valid: false,
                raw: response,
                error: 'Empty response'
            };
        }

        try {
            const structured = this.extractStructuredOutput(response);

            if (structured) {
                const {term, truth} = termParser.parseWithTruth(structured.narsese);
                const finalTruth = structured.truth
                    ? Truth.create(structured.truth.f, structured.truth.c)
                    : (truth ?? defaultTruth ?? Truth.NEUTRAL);

                return {
                    term,
                    truth: finalTruth,
                    confidence: structured.confidence,
                    raw: response,
                    valid: true
                };
            }

            const plainText = response.trim();
            const {term, truth} = termParser.parseWithTruth(plainText);
            const finalTruth = truth ?? defaultTruth ?? Truth.NEUTRAL;

            return {
                term,
                truth: finalTruth,
                raw: response,
                valid: true
            };
        } catch (error) {
            const extractedTerm = this.extractTermFromText(response);
            if (extractedTerm) {
                return {
                    term: extractedTerm,
                    truth: defaultTruth ?? Truth.NEUTRAL,
                    raw: response,
                    valid: true
                };
            }

            return {
                term: termParser.parse('TRUE'),
                truth: defaultTruth ?? Truth.NEUTRAL,
                raw: response,
                valid: false,
                error: error instanceof Error ? error.message : 'Failed to parse Narsese'
            };
        }
    }

    static validate(response: string): { valid: boolean; error?: string } {
        if (!response || response.trim() === '') {
            return {valid: false, error: 'Empty response'};
        }

        if (response.includes('-->') || response.includes('=>') || response.includes('<->')) {
            return {valid: true};
        }

        if (response.includes('{') && response.includes('}')) {
            try {
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    JSON.parse(jsonMatch[0]);
                    return {valid: true};
                }
            } catch {
                return {valid: false, error: 'Invalid JSON in response'};
            }
        }

        return {valid: true};
    }

    private static extractStructuredOutput(response: string): StructuredLMOutput | null {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        try {
            const jsonStr = jsonMatch[0];
            const obj = JSON.parse(jsonStr);

            if (typeof obj.narsese === 'string') {
                return {
                    narsese: obj.narsese,
                    truth: obj.truth,
                    confidence: obj.confidence
                };
            }
        } catch {
            return null;
        }

        return null;
    }

    private static extractTermFromText(text: string): Term | null {
        const inheritanceMatch = text.match(/\(([^()]+)\s*-->\s*([^()]+)\)/);
        if (inheritanceMatch) {
            try {
                return termParser.parse(inheritanceMatch[0]);
            } catch {
                return null;
            }
        }

        const implicationMatch = text.match(/\(([^()]+)\s*=>\s*([^()]+)\)/);
        if (implicationMatch) {
            try {
                return termParser.parse(implicationMatch[0]);
            } catch {
                return null;
            }
        }

        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.includes('-->') || trimmed.includes('=>') || trimmed.includes('<->')) {
                try {
                    return termParser.parse(trimmed);
                } catch {
                    continue;
                }
            }
        }

        return null;
    }
}
