import { Parser } from '../../Parser.js';
import { Term } from '../Term.js';
import { strVal } from './OpUtils.js';

export function registerIOParser(registry) {
    registry.register('&sread', (str) => {
        try {
            const parsed = Parser.parseProgram(strVal(str));
            return parsed?.length ? parsed[0] : Term.sym('False');
        } catch {
            return Term.sym('False');
        }
    });

    registry.register('&balance-parens', (str) => {
        let s = strVal(str);
        let depth = 0;
        for (const ch of s) {
            if (ch === '(') {
                depth++;
            } else if (ch === ')') {
                depth--;
            }
        }
        while (depth > 0) {
            s += ')';
            depth--;
        }
        return Term.sym(s);
    });
}
