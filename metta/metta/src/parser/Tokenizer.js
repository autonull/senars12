/**
 * Tokenizer.js - Tokenizes input strings into tokens for parsing
 */

export class Tokenizer {
    /**
     * Tokenize an input string
     * @param {string} str - The input string to tokenize
     * @returns {string[]} Array of tokens
     */
    tokenize(str) {
        const tokens = [];
        let current = '';
        let inString = false;
        let quoteChar = null;
        let inComment = false;

        const push = () => {
            const trimmed = current.trim();
            if (trimmed) {
                tokens.push(trimmed);
            }
            current = '';
        };

        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const next = str[i + 1];

            if (inComment) {
                if (char === '\n' || char === '\r') {
                    inComment = false;
                }
                continue;
            }

            if (inString) {
                current += char;
                if (char === quoteChar) {
                    inString = false;
                    tokens.push(current);
                    current = '';
                    quoteChar = null;
                }
                continue;
            }

            switch (char) {
                case '"':
                case "'":
                    push();
                    inString = true;
                    quoteChar = char;
                    current += char;
                    break;

                case '/':
                    if (next === '/') {
                        push();
                        inComment = true;
                        i++; // Skip '/'
                    } else {
                        current += char;
                    }
                    break;

                case ';':
                    push();
                    inComment = true;
                    break;

                case '(':
                case ')':
                    push();
                    tokens.push(char);
                    break;

                default:
                    if (/\s/.test(char)) {
                        push();
                    } else {
                        current += char;
                    }
            }
        }

        push();
        return tokens;
    }
}
