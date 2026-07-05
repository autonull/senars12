/**
 * MeTTaIL.js - MORK-parity Phase P3-A: Intermediate Representation
 * IL node types: SYMBOL, NUMBER, EXPR, GROUND_CALL, LET_BIND, IF, SUPERPOSE
 */

import {isExpression, isVariable} from './Term.js';
import {Logger} from '@senars/core';

export const ILKind = {
    SYMBOL: 0, NUMBER: 1, EXPR: 2, GROUND_CALL: 3,
    LET_BIND: 4, IF: 5, SUPERPOSE: 6, MATCH: 7, LET_STAR: 8, FUNCTION_CALL: 9
};

export class ILNode {
    constructor(kind, arity = 0, opId = 0, value = null) {
        this.kind = kind;
        this.arity = arity;
        this.opId = opId;
        this.value = value;
        this.children = [];
    }

    static symbol(name) {
        return new ILNode(ILKind.SYMBOL, 0, 0, name);
    }

    static number(value) {
        return new ILNode(ILKind.NUMBER, 0, 0, value);
    }

    static expr(operator, children = []) {
        const node = new ILNode(ILKind.EXPR, children.length);
        node.children = [operator, ...children];
        return node;
    }

    static groundCall(opId, args = []) {
        const node = new ILNode(ILKind.GROUND_CALL, args.length, opId);
        node.children = [...args];
        return node;
    }

    static letBind(varNode, valNode, bodyNode) {
        const node = new ILNode(ILKind.LET_BIND, 3);
        node.children = [varNode, valNode, bodyNode];
        return node;
    }

    static if(condNode, thenNode, elseNode) {
        const node = new ILNode(ILKind.IF, 3);
        node.children = [condNode, thenNode, elseNode];
        return node;
    }

    static superpose(alts = []) {
        const node = new ILNode(ILKind.SUPERPOSE, alts.length);
        node.children = [...alts];
        return node;
    }

    equals(other) {
        if (!other || this.kind !== other.kind || this.arity !== other.arity || this.opId !== other.opId) {
            return false;
        }
        if (this.value !== other.value || this.children.length !== other.children.length) {
            return false;
        }
        return this.children.every((c, i) => c.equals(other.children[i]));
    }

    clone() {
        const node = new ILNode(this.kind, this.arity, this.opId, this.value);
        node.children = [...this.children];
        return node;
    }

    deepClone() {
        const node = new ILNode(this.kind, this.arity, this.opId, this.value);
        node.children = this.children.map(c => c.deepClone());
        return node;
    }
}

export const ILLower = {
    lower(term, ground) {
        if (!term) {
            return ILNode.symbol('()');
        }
        if (isVariable(term)) {
            return ILNode.symbol(term.name);
        }
        if (typeof term === 'number') {
            return ILNode.number(term);
        }
        if (typeof term.name === 'string' && !term.components) {
            return isNaN(Number(term.name)) ? ILNode.symbol(term.name) : ILNode.number(Number(term.name));
        }
        if (isExpression(term)) {
            return this.lowerExpression(term, ground);
        }
        return ILNode.symbol(String(term));
    },

    lowerExpression(expr, ground) {
        const op = expr.operator;
        const comps = expr.components || [];
        const opName = op?.name || op;

        if (opName === 'let' && comps.length === 3) {
            return this.lowerLet(expr, ground);
        }
        if (opName === 'let*' && comps.length >= 2) {
            return this.lowerLetStar(expr, ground);
        }
        if (opName === 'if' && comps.length >= 3) {
            return this.lowerIf(expr, ground);
        }
        if (opName === 'superpose' && comps.length > 0) {
            return this.lowerSuperpose(expr, ground);
        }
        if (opName === 'match' && comps.length >= 3) {
            return this.lowerMatch(expr, ground);
        }

        if (op && ground?.has(op)) {
            const opId = ground.getOpId(op);
            return ILNode.groundCall(opId, comps.map(c => this.lower(c, ground)));
        }

        return ILNode.expr(this.lower(op, ground), comps.map(c => this.lower(c, ground)));
    },

    lowerLet(expr, ground) {
        const [v, val, body] = expr.components;
        return ILNode.letBind(this.lower(v, ground), this.lower(val, ground), this.lower(body, ground));
    },

    lowerLetStar(expr, ground) {
        const comps = expr.components;
        if (comps.length < 2) {
            return ILNode.symbol('()');
        }

        const bindings = [];
        let i = 0;
        while (i < comps.length - 1) {
            const binding = comps[i];
            if (isExpression(binding) && binding.operator?.name === ':') {
                bindings.push({
                    var: this.lower(binding.components[0], ground),
                    val: this.lower(binding.components[1], ground)
                });
                i++;
            } else if (isExpression(binding)) {
                bindings.push({
                    var: this.lower(binding.operator, ground),
                    val: this.lower(binding.components[0], ground)
                });
                i++;
            } else {
                break;
            }
        }

        const body = this.lower(comps[comps.length - 1], ground);
        return bindings.reduceRight((acc, b) => ILNode.letBind(b.var, b.val, acc), body);
    },

    lowerIf(expr, ground) {
        const [cond, thenB, elseB] = expr.components;
        return ILNode.if(this.lower(cond, ground), this.lower(thenB, ground), this.lower(elseB || ILNode.symbol('()'), ground));
    },

    lowerSuperpose(expr, ground) {
        return ILNode.superpose(expr.components.map(c => this.lower(c, ground)));
    },

    lowerMatch(expr, ground) {
        const [target, pattern, template] = expr.components;
        return ILNode.expr(ILNode.symbol('match'), [this.lower(target, ground), this.lower(pattern, ground), this.lower(template, ground)]);
    }
};

export const ILOpt = {
    optimize(il, ground) {
        let result = il;
        result = this.constantFold(result, ground);
        result = this.inlinePureGroundCalls(result, ground);
        result = this.deadBranchElimination(result);
        result = this.commonSubexpressionElimination(result);
        return result;
    },

    constantFold(il, ground) {
        if (!il) {
            return il;
        }
        const node = il.clone();
        node.children = il.children.map(c => this.constantFold(c, ground));

        if (node.kind === ILKind.GROUND_CALL && ground) {
            const allConstants = node.children.every(c => c.kind === ILKind.NUMBER || (c.kind === ILKind.SYMBOL && !isNaN(Number(c.value))));
            if (allConstants) {
                try {
                    const args = node.children.map(c => c.kind === ILKind.NUMBER ? c.value : Number(c.value));
                    const op = ground.getOpById(node.opId);
                    if (op && ground.isPure(op)) {
                        const result = ground.execute(op, ...args);
                        if (typeof result === 'number') {
                            return ILNode.number(result);
                        }
                    }
                } catch (e) { /* Keep node on error */
                }
            }
        }

        if (node.kind === ILKind.EXPR && node.children[0]?.kind === ILKind.SYMBOL) {
            const opName = node.children[0].value;
            const args = node.children.slice(1);
            if (args.every(a => a.kind === ILKind.NUMBER) && ['+', '-', '*', '/'].includes(opName)) {
                const values = args.map(a => a.value);
                let result;
                switch (opName) {
                    case '+':
                        result = values.reduce((a, b) => a + b, 0);
                        break;
                    case '-':
                        result = values.length === 1 ? -values[0] : values.reduce((a, b) => a - b);
                        break;
                    case '*':
                        result = values.reduce((a, b) => a * b, 1);
                        break;
                    case '/':
                        result = values.reduce((a, b) => a / b);
                        break;
                }
                if (result !== undefined) {
                    return ILNode.number(result);
                }
            }
        }
        return node;
    },

    inlinePureGroundCalls(il, ground) {
        if (!il) {
            return il;
        }
        const node = il.clone();
        node.children = il.children.map(c => this.inlinePureGroundCalls(c, ground));
        if (node.kind === ILKind.GROUND_CALL && ground) {
            const op = ground.getOpById(node.opId);
            if (op && ground.isPure(op) && node.children.length <= 2) {
                node.opId = -node.opId;
            }
        }
        return node;
    },

    deadBranchElimination(il) {
        if (!il) {
            return il;
        }
        const node = il.clone();
        node.children = il.children.map(c => this.deadBranchElimination(c));

        if (node.kind === ILKind.IF) {
            const [cond, thenB, elseB] = node.children;
            if (cond.kind === ILKind.SYMBOL) {
                if (cond.value === 'True') {
                    return thenB;
                }
                if (cond.value === 'False') {
                    return elseB;
                }
            }
            if (cond.kind === ILKind.NUMBER) {
                return cond.value !== 0 ? thenB : elseB;
            }
        }

        if (node.kind === ILKind.SUPERPOSE) {
            node.children = node.children.filter(c => !(c.kind === ILKind.SYMBOL && c.value === '()'));
        }
        return node;
    },

    commonSubexpressionElimination(il) {
        const seen = new Map();
        return this._cseInternal(il, seen);
    },

    _cseInternal(il, seen) {
        if (!il) {
            return il;
        }
        const key = this._nodeKey(il);
        if (seen.has(key) && il.kind !== ILKind.SYMBOL && il.kind !== ILKind.NUMBER) {
            return seen.get(key);
        }
        const node = il.clone();
        node.children = il.children.map(c => this._cseInternal(c, seen));
        if (il.kind !== ILKind.SYMBOL && il.kind !== ILKind.NUMBER) {
            seen.set(key, node);
        }
        return node;
    },

    _nodeKey(il) {
        if (!il) {
            return '';
        }
        return [il.kind, il.arity, il.opId, il.value, ...il.children.map(c => this._nodeKey(c))].join('|');
    }
};

export const ILEmit = {
    emit(il, ground) {
        const body = this.emitNode(il, ground);
        return `(function(ground, space) {
      const subst = (term, bindings) => ground.subst(term, bindings);
      const unify = (a, b) => ground.unify(a, b);
      const execute = (opId, ...args) => ground.executeById(opId, ...args);
      const sym = (name) => ({ name: String(name) });
      const num = (n) => ({ name: String(n) });
      const exp = (op, comps) => ({ operator: op, components: comps });
      ${body}
    })`;
    },

    emitNode(il, ground, indent = '      ') {
        switch (il.kind) {
            case ILKind.SYMBOL:
                return `sym(${JSON.stringify(il.value)})`;
            case ILKind.NUMBER:
                return `num(${il.value})`;
            case ILKind.GROUND_CALL: {
                const opId = Math.abs(il.opId);
                const args = il.children.map(c => this.emitNode(c, ground, indent)).join(', ');
                return `execute(${opId}, ${args})`;
            }
            case ILKind.LET_BIND: {
                const [varNode, valNode, bodyNode] = il.children;
                const varName = varNode.value || 'v';
                return `(() => { const ${varName} = ${this.emitNode(valNode, ground, indent)}; return ${this.emitNode(bodyNode, ground, indent)}; })()`;
            }
            case ILKind.IF: {
                const [cond, thenB, elseB] = il.children;
                return `(() => { const cond = ${this.emitNode(cond, ground)}; return (cond && cond.name === 'True') ? ${this.emitNode(thenB, ground)} : ${this.emitNode(elseB, ground)}; })()`;
            }
            case ILKind.SUPERPOSE:
                return `[${il.children.map(c => this.emitNode(c, ground, indent)).join(', ')}]`;
            case ILKind.EXPR: {
                if (il.children.length === 0) {
                    return `sym('()')`;
                }
                const op = this.emitNode(il.children[0], ground, indent);
                const args = il.children.slice(1).map(c => this.emitNode(c, ground, indent));
                return `exp(${op}, [${args.join(', ')}])`;
            }
            default:
                return `null`;
        }
    }
};

export function compileIL(il, ground) {
    const source = ILEmit.emit(il, ground);
    try {
        return new Function('ground', 'space', source);
    } catch (e) {
        Logger.warn('IL compilation failed:', e.message);
        return null;
    }
}
