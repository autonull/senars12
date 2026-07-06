import {Tokenizer} from './parser/Tokenizer.js';
import {InternalParser} from './parser/InternalParser.js';

export class Parser {
    #tokenizer = new Tokenizer();

    parse(str) {
        const tokens = this.#tokenizer.tokenize(str);
        return tokens.length ? new InternalParser(tokens).parse() : null;
    }

    parseProgram(str) {
        const tokens = this.#tokenizer.tokenize(str);
        return new InternalParser(tokens).parseProgram();
    }

    parseExpression(str) {
        return this.parse(str);
    }
}
