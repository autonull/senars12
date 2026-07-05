export class AdvancedNarseseTranslator {
    constructor() {
        // Store patterns pre-sorted by confidence for performance
        this.forwardPatterns = [
            {
                regex: /(.*)\s+is\s+(?:a|an|a kind of|a type of|a sort of)\s+(.*)/i,
                replacement: '($1 --> $2).',
                confidence: 0.9
            },
            {regex: /(.*)s\s+are\s+(.*)/i, replacement: '($1 --> $2).', confidence: 0.9},
            {
                regex: /(.*)\s+(?:resembles|is similar to|is like|is similar as)\s+(.*)/i,
                replacement: '($1 <-> $2).',
                confidence: 0.85
            },
            {regex: /(?:if|when)\s+(.*)\s+then\s+(.*)/i, replacement: '($1 ==> $2).', confidence: 0.9},
            {regex: /(.*)\s+(?:causes|leads to|results in)\s+(.*)/i, replacement: '($1 ==> $2).', confidence: 0.85},
            {regex: /(.*)\s+if and only if\s+(.*)/i, replacement: '($1 <=> $2).', confidence: 0.8},
            {
                regex: /(.*)\s+(?:is equivalent to|is the same as)\s+(.*)/i,
                replacement: '($1 <=> $2).',
                confidence: 0.8
            },
            {regex: /(.*)\s+and\s+(.*)/i, replacement: '(&, $1, $2).', confidence: 0.9},
            {regex: /(.*)\s+or\s+(.*)/i, replacement: '(|, $1, $2).', confidence: 0.9},
            {regex: /\bnot\s+(.*)/i, replacement: '(--, $1).', confidence: 0.9},
        ].sort((a, b) => b.confidence - a.confidence);

        this.reversePatterns = [
            {regex: /\((.+?)\s+-->\s+(.+?)\)\./, replacement: '$1 is a $2', confidence: 0.9},
            {regex: /\((.+?)\s+<->\s+(.+?)\)\./, replacement: '$1 is similar to $2', confidence: 0.85},
            {regex: /\((.+?)\s+==>\s+(.+?)\)\./, replacement: 'if $1 then $2', confidence: 0.9},
            {regex: /\((.+?)\s+<=>\s+(.+?)\)\./, replacement: '$1 if and only if $2', confidence: 0.8},
            {regex: /\(&,\s*(.+?),\s*(.+?)\)\./, replacement: '$1 and $2', confidence: 0.9},
            {regex: /\(\|,\s*(.+?),\s*(.+?)\)\./, replacement: '$1 or $2', confidence: 0.9},
            {regex: /\(--,\s*(.+?)\)\./, replacement: 'not $1', confidence: 0.9},
        ].sort((a, b) => b.confidence - a.confidence);

        this.contextBuffer = [];
        this.translationHistory = [];
        this.minConfidence = 0.7;
        this.maxContextSize = 10;
        this.maxHistorySize = 100;
    }

    addContext(context) {
        if (this.contextBuffer.length >= this.maxContextSize) {
            // Use a more efficient approach: remove the first element and add the new one
            this.contextBuffer = this.contextBuffer.slice(1).concat(context);
        } else {
            this.contextBuffer.push(context);
        }
    }

    toNarsese(text, options = {}) {
        if (typeof text !== 'string') {
            throw new Error('Input must be a string');
        }

        const originalText = text;

        for (const pattern of this.forwardPatterns) {
            const match = text.match(pattern.regex);
            if (match) {
                const result = pattern.replacement
                    .replace('$1', match[1]?.trim() || '')
                    .replace('$2', match[2]?.trim() || '');

                return this._recordTranslation(originalText, result, pattern.confidence, pattern.regex.toString());
            }
        }

        return this._recordTranslation(originalText, `(${text.replace(/\s+/g, '_')} --> statement).`, 0.3, 'fallback');
    }

    fromNarsese(narsese, options = {}) {
        if (typeof narsese !== 'string') {
            throw new Error('Input must be a string');
        }

        const originalNarsese = narsese;

        for (const pattern of this.reversePatterns) {
            const match = narsese.match(pattern.regex);
            if (match) {
                const result = pattern.replacement
                    .replace('$1', match[1]?.replace(/_/g, ' ') || '')
                    .replace('$2', match[2]?.replace(/_/g, ' ') || '');

                return this._recordTranslation(originalNarsese, result, pattern.confidence, pattern.regex.toString(), true);
            }
        }

        return this._recordTranslation(originalNarsese, originalNarsese, 0.2, 'none', true);
    }

    _recordTranslation(original, translated, confidence, patternUsed, isReverse = false) {
        const translationEntry = {
            original,
            translated,
            confidence,
            timestamp: Date.now(),
            patternUsed
        };

        if (this.translationHistory.length >= this.maxHistorySize) {
            // More efficient approach: replace old entries instead of shifting
            this.translationHistory = this.translationHistory.slice(1).concat(translationEntry);
        } else {
            this.translationHistory.push(translationEntry);
        }

        const result = isReverse
            ? {text: translated, confidence, original, context: this.contextBuffer}
            : {narsese: translated, confidence, original, context: this.contextBuffer};

        return this.applyErrorCorrection(result);
    }

    async iterativeTranslate(text, options = {}) {
        const initialResult = this.toNarsese(text, options);
        return initialResult.confidence < this.minConfidence
            ? {
                ...initialResult,
                refined: false,
                notes: `Low confidence (${initialResult.confidence}) - consider providing more context or rephrasing`
            }
            : initialResult;
    }

    getQualityMetrics() {
        if (this.translationHistory.length === 0) {
            return {totalTranslations: 0, averageConfidence: 0, highConfidenceRate: 0, lowConfidenceRate: 0};
        }

        const total = this.translationHistory.length;
        const totalConfidence = this.translationHistory.reduce((sum, entry) => sum + entry.confidence, 0);
        const highConfidence = this.translationHistory.filter(entry => entry.confidence >= this.minConfidence).length;
        const lowConfidence = this.translationHistory.filter(entry => entry.confidence < 0.5).length;

        return {
            totalTranslations: total,
            averageConfidence: totalConfidence / total,
            highConfidenceRate: highConfidence / total,
            lowConfidenceRate: lowConfidence / total,
            lastTranslations: this.translationHistory.slice(-5)
        };
    }

    validateSemanticPreservation(originalText, narsese, backToText) {
        const lowerOriginal = originalText.toLowerCase();
        const lowerBack = backToText.toLowerCase();

        const originalWords = new Set(lowerOriginal.split(/\s+/));
        const backWords = new Set(lowerBack.split(/\s+/));

        const commonWords = [...originalWords].filter(word => backWords.has(word)).length;
        const totalWords = new Set([...originalWords, ...backWords]).size;
        const similarity = totalWords > 0 ? commonWords / totalWords : 0;

        return {
            similar: similarity > 0.5,
            similarity,
            original: originalText,
            narsese,
            backToNatural: backToText,
            preserved: similarity > 0.5
        };
    }

    applyErrorCorrection(result) {
        if (result.narsese && result.narsese.includes(' --> ') &&
            !result.narsese.endsWith('.') && !result.narsese.endsWith('?') && !result.narsese.endsWith('!')) {
            result.narsese += '.';
        }

        if (result.narsese?.includes('()')) {
            result.confidence = Math.min(result.confidence, 0.3);
            result.notes = `${result.notes || ''} Potential syntax error: empty parentheses found.`;
        }

        return result;
    }
}