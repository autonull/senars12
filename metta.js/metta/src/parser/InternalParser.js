/**
 * InternalParser.js - Internal parser logic
 */

import {exp, sym, variable} from '../kernel/Term.js';
import {Logger} from '@senars/core';

export class InternalParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    /**
     * Check if parsing is finished
     */
    get finished() {
        return this.pos >= this.tokens.length;
    }

    /**
     * Peek at the current token without consuming it
     */
    peek() {
        return this.tokens[this.pos];
    }

    /**
     * Consume the current token and advance position
     */
    consume() {
        return this.tokens[this.pos++];
    }

    /**
     * Parse a single atom or expression
     */
    parse() {
        if (this.finished) {
            throw new Error("Unexpected end of input");
        }

        const token = this.peek();
        if (token === '(') {
            return this.parseExpression();
        }

        this.consume();
        // Support both $ and ? variables
        return token.startsWith('$') || token.startsWith('?') ? variable(token) : sym(token);
    }

    /**
     * Parse an expression (list of atoms enclosed in parentheses)
     */
    parseExpression() {
        if (this.consume() !== '(') {
            throw new Error("Expected '(' at start of expression");
        }

        if (!this.finished && this.peek() === ')') {
            this.consume();
            return sym('()');
        }

        const components = [];
        while (!this.finished && this.peek() !== ')') {
            try {
                components.push(this.parse());
            } catch (error) {
                throw new Error(`Error parsing expression component: ${error.message}`);
            }
        }

        if (this.finished) {
            throw new Error("Unexpected end of input, expected ')'");
        }

        this.consume(); // Skip ')'

        return components.length > 0 ? exp(components[0], components.slice(1)) : sym('()');
    }

    /**
     * Parse a program (sequence of expressions)
     */
    parseProgram() {
        const expressions = [];
        while (!this.finished) {
            try {
                const token = this.peek();
                // Basic validity check
                if (token === '(' || /^[?$].+/.test(token) || token.length > 0) {
                    expressions.push(this.parse());
                } else {
                    this.consume();
                }
            } catch (error) {
                // Skip invalid tokens and continue parsing
                Logger.warn(`Skipping invalid token: ${this.peek()}`, error);
                this.consume();
            }
        }
        return expressions;
    }
}
