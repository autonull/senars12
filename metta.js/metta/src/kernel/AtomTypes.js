/**
 * AtomTypes.js - Class definitions for MeTTa atoms
 * Ensures Stable Object Shapes (Tier 1 Optimization)
 */

import {TYPE_EXPRESSION, TYPE_GROUNDED, TYPE_SYMBOL, TYPE_VARIABLE} from './FastPaths.js';

export class SymbolAtom {
    constructor(name) {
        this.type = 'atom';
        this.name = name;
        this.operator = null;
        this.components = [];
        this._typeTag = TYPE_SYMBOL;
        this._hash = null;
        this._metadata = null;
    }

    toString() {
        return this.name;
    }

    equals(o) {
        if (this === o) {
            return true;
        }
        return o?._typeTag === TYPE_SYMBOL && o.name === this.name;
    }
}

export class VariableAtom {
    constructor(name) {
        this.type = 'atom';
        this.name = name;
        this.operator = null;
        this.components = [];
        this._typeTag = TYPE_VARIABLE;
        this._hash = null;
        this._metadata = null;
    }

    toString() {
        return this.name;
    }

    equals(o) {
        // Variables are usually equal by name in MeTTa
        // but bound variables might have different semantics in unification
        return o?.type === 'atom' && o.name === this.name;
    }
}

export class GroundedAtom {
    constructor(value, name) {
        this.type = 'grounded';
        this.value = value;
        this.name = name;
        this.operator = null;
        this.components = [];
        this._typeTag = TYPE_GROUNDED;
        this._hash = null;
        this._metadata = null;
    }

    toString() {
        try {
            if (this.value && typeof this.value.toString === 'function' && this.value.toString !== Object.prototype.toString) {
                return this.value.toString();
            }
        } catch (e) {
            // Fallback
        }
        return this.name;
    }

    equals(other) {
        return other?.type === 'grounded' && other.value === this.value;
    }
}

export class ExpressionAtom {
    constructor(name, operator, components) {
        this.type = 'compound';
        this.name = name;
        this.operator = operator;
        this.components = Object.freeze([...components]);
        this._typeTag = TYPE_EXPRESSION;
        this._hash = null;
        this._metadata = null;
    }

    toString() {
        return this.name;
    }

    equals(other) {
        if (other?.type !== 'compound' || other.components.length !== this.components.length) {
            return false;
        }
        const opEq = this.operator.equals ? this.operator.equals(other.operator) : this.operator === other.operator;
        return opEq && this.components.every((c, i) => c && c.equals ? c.equals(other.components[i]) : c === other.components[i]);
    }
}
