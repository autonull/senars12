import type {Schema, Tool, ToolResult} from './types';

function parseMathExpression(expr: string): number {
    let pos = 0;

    function skipWhitespace(): void {
        while (pos < expr.length && /\s/.test(expr[pos]!)) pos++;
    }

    function parseNumber(): number {
        skipWhitespace();
        let numStr = '';
        while (pos < expr.length && (expr[pos]!.match(/[0-9.]/))) {
            numStr += expr[pos];
            pos++;
        }
        if (numStr === '') {
            throw new Error('Expected number');
        }
        const num = Number(numStr);
        if (isNaN(num)) {
            throw new Error('Invalid number');
        }
        return num;
    }

    function parseFactor(): number {
        skipWhitespace();
        if (expr[pos] === '(') {
            pos++;
            const result = parseExpression();
            skipWhitespace();
            if (expr[pos] !== ')') {
                throw new Error('Expected closing parenthesis');
            }
            pos++;
            return result;
        } else if (expr[pos] === '-') {
            pos++;
            return -parseFactor();
        } else if (expr[pos] === '+') {
            pos++;
            return parseFactor();
        } else {
            return parseNumber();
        }
    }

    function parseTerm(): number {
        let left = parseFactor();
        while (true) {
            skipWhitespace();
            if (expr[pos] === '*') {
                pos++;
                left *= parseFactor();
            } else if (expr[pos] === '/') {
                pos++;
                const right = parseFactor();
                left /= right;
            } else {
                break;
            }
        }
        return left;
    }

    function parseExpression(): number {
        let left = parseTerm();
        while (true) {
            skipWhitespace();
            if (expr[pos] === '+') {
                pos++;
                left += parseTerm();
            } else if (expr[pos] === '-') {
                pos++;
                left -= parseTerm();
            } else {
                break;
            }
        }
        return left;
    }

    skipWhitespace();
    const result = parseExpression();
    skipWhitespace();
    if (pos < expr.length) {
        throw new Error(`Unexpected character at position ${pos}: ${expr[pos]}`);
    }
    return result;
}

export class CalculateTool implements Tool {
    readonly name = 'calculate';
    readonly description = 'Mathematical computation tool';
    readonly parameters: Schema = {
        type: 'object',
        properties: {
            expression: {type: 'string', description: 'Mathematical expression to evaluate'}
        },
        required: ['expression']
    };

    async execute(args: Record<string, unknown>): Promise<ToolResult> {
        const {expression} = args as { expression: string };

        try {
            const sanitized = expression.trim();
            if (!sanitized || /[^0-9+\-*/().\s]/.test(sanitized)) {
                return {
                    success: false,
                    content: null,
                    error: 'Invalid characters in expression. Only digits, +, -, *, /, (, ), and spaces allowed'
                };
            }

            const result = parseMathExpression(sanitized);
            return {
                success: true,
                content: result
            };
        } catch (error) {
            return {
                success: false,
                content: null,
                error: error instanceof Error ? error.message : 'Calculation failed'
            };
        }
    }
}
