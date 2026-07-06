export class NarseseTranslator {
    constructor() {
        this.patterns = {
            forward: [
                {regex: /(.*)\s+is\s+(?:a|an|a kind of|a type of|a sort of)\s+(.*)/i, replacement: '($1 --> $2).'},
                {regex: /(.*)s\s+are\s+(.*)/i, replacement: '($1 --> $2).'},
                {
                    regex: /(.*)\s+(?:resembles|is similar to|is like|is similar as)\s+(.*)/i,
                    replacement: '($1 <-> $2).'
                },
                {regex: /(?:if|when)\s+(.*)\s+then\s+(.*)/i, replacement: '($1 ==> $2).'},
                {regex: /(.*)\s+(?:causes|leads to|results in)\s+(.*)/i, replacement: '($1 ==> $2).'},
                {regex: /(.*)\s+if and only if\s+(.*)/i, replacement: '($1 <=> $2).'},
                {regex: /(.*)\s+(?:is equivalent to|is the same as)\s+(.*)/i, replacement: '($1 <=> $2).'},
                {regex: /(.*)\s+and\s+(.*)/i, replacement: '(&, $1, $2).'},
                {regex: /(.*)\s+or\s+(.*)/i, replacement: '(|, $1, $2).'},
                {regex: /\bnot\s+(.*)/i, replacement: '(--, $1).'},
            ],
            reverse: [
                {regex: /\((.+?)\s+-->\s+(.+?)\)\./, replacement: '$1 is a $2'},
                {regex: /\((.+?)\s+<->\s+(.+?)\)\./, replacement: '$1 is similar to $2'},
                {regex: /\((.+?)\s+==>\s+(.+?)\)\./, replacement: 'if $1 then $2'},
                {regex: /\((.+?)\s+<=>\s+(.+?)\)\./, replacement: '$1 if and only if $2'},
                {regex: /\(&,\s*(.+?),\s*(.+?)\)\./, replacement: '$1 and $2'},
                {regex: /\(\|,\s*(.+?),\s*(.+?)\)\./, replacement: '$1 or $2'},
                {regex: /\(--,\s*(.+?)\)\./, replacement: 'not $1'},
            ]
        };
    }

    toNarsese(text, confidence = null) {
        if (typeof text !== 'string') {
            throw new Error('Input must be a string');
        }

        // Clean up trailing punctuation to avoid double punctuation in replacement
        let cleanText = text.trim();
        if (cleanText.endsWith('.') || cleanText.endsWith('!') || cleanText.endsWith('?')) {
            cleanText = cleanText.slice(0, -1);
        }

        let narsese = '';
        let found = false;

        for (const pattern of this.patterns.forward) {
            const match = cleanText.match(pattern.regex);
            if (match) {
                narsese = pattern.replacement
                    .replace('$1', match[1].trim())
                    .replace('$2', match[2].trim());
                found = true;
                break;
            }
        }

        if (!found) {
            narsese = `(${cleanText.replace(/\s+/g, '_')} --> statement).`;
        }

        if (confidence !== null) {
            // Append truth value if provided
            // Narsese truth format: %frequency;confidence%
            // We assume frequency 1.0 for positive statements
            narsese = `${narsese} %1.0;${confidence.toFixed(2)}%`;
        }

        return narsese;
    }

    fromNarsese(narsese) {
        if (typeof narsese !== 'string') {
            throw new Error('Input must be a string');
        }

        for (const pattern of this.patterns.reverse) {
            const match = narsese.match(pattern.regex);
            if (match) {
                return pattern.replacement
                    .replace('$1', match[1].replace(/_/g, ' '))
                    .replace('$2', match[2].replace(/_/g, ' '));
            }
        }

        return narsese;
    }
}