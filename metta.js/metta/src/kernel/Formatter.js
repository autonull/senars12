import {flattenList, isExpression, isList} from './Term.js';

export class Formatter {
    static toHyperonString(atom) {
        if (!atom) {
            return 'null';
        }
        if (isList(atom)) {
            const {elements, tail} = flattenList(atom);
            if (tail.name === '()') {
                return `(${elements.map(Formatter.toHyperonString).join(' ')})`;
            }
        }
        if (isExpression(atom)) {
            const op = Formatter.toHyperonString(atom.operator);
            const comps = atom.components.map(Formatter.toHyperonString).join(' ');
            return `(${op}${comps ? ` ${comps}` : ''})`;
        }
        return atom.toString();
    }

    static formatResult(results) {
        return Array.isArray(results)
            ? `[${results.map(Formatter.toHyperonString).join(', ')}]`
            : Formatter.toHyperonString(results);
    }
}
