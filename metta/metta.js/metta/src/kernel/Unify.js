import { configManager } from '../config/config.js';
import { SMTBridge } from '../extensions/SMTOps.js';
import { TYPE_SYMBOL, isSymbol as fastIsSymbol, getTypeTag } from './FastPaths.js';
import { constructList, exp, flattenList, isExpression, isList, isVariable, sym } from './Term.js';

function isVar(t) {
  return t?.isVariable || isVariable(t);
}

function occursIn(name, term) {
  if (!term || typeof term !== 'object') return false;
  if (isVar(term)) return term.name === name;
  if (isExpression(term)) {
    if (typeof term.operator === 'object' && occursIn(name, term.operator)) return true;
    return term.components?.some((c) => occursIn(name, c));
  }
  return false;
}

function coreUnify(t1, t2, bindings = {}, adapter) {
  if (!bindings) return null;
  if (adapter?.preUnify) {
    const pre = adapter.preUnify(t1, t2, bindings);
    if (pre !== undefined) return pre;
  }

  const v1 = adapter?.isVariable ? adapter.isVariable(t1) : isVar(t1);
  const v2 = adapter?.isVariable ? adapter.isVariable(t2) : isVar(t2);

  if (v1) {
    const name = adapter?.getVariableName ? adapter.getVariableName(t1) : t1?.name;
    if (bindings[name] !== undefined) return coreUnify(bindings[name], t2, bindings, adapter);
    if (v2 && (adapter?.getVariableName?.(t2) ?? t2?.name) === name) return bindings;
    if (occursIn(name, t2)) return null;
    return { ...bindings, [name]: t2 };
  }
  if (v2) {
    const name = adapter?.getVariableName ? adapter.getVariableName(t2) : t2?.name;
    if (bindings[name] !== undefined) return coreUnify(t1, bindings[name], bindings, adapter);
    if (occursIn(name, t1)) return null;
    return { ...bindings, [name]: t1 };
  }

  if (adapter?.equals?.(t1, t2)) return bindings;

  const op1 = adapter?.getOperator ? adapter.getOperator(t1) : t1?.operator;
  const op2 = adapter?.getOperator ? adapter.getOperator(t2) : t2?.operator;
  const c1 = adapter?.getComponents ? adapter.getComponents(t1) : t1?.components || [];
  const c2 = adapter?.getComponents ? adapter.getComponents(t2) : t2?.components || [];

  if (!op1 && !op2) {
    return t1 === t2 || t1?.name === t2?.name ? bindings : null;
  }

  if (op1 !== op2 && !(typeof op1 === 'object' && typeof op2 === 'object')) return null;
  if (c1.length !== c2.length) return null;

  let result = bindings;
  for (let i = 0; i < c1.length && result; i++) {
    result = coreUnify(c1[i], c2[i], result, adapter);
  }
  if (typeof op1 === 'object' && typeof op2 === 'object' && result) {
    result = coreUnify(op1, op2, result, adapter);
  }
  return result;
}

let _smtBridge = null;
const getSMTBridge = () => (_smtBridge ??= configManager.get('smt') ? new SMTBridge() : null);

const safeSubstitute = (rootTerm, bindings, rootVisited = new Set(), recursive = true) => {
  if (!rootTerm || !bindings || Object.keys(bindings).length === 0) {
    return rootTerm;
  }

  const stack = [{ type: 'PROCESS', term: rootTerm, visited: rootVisited }];
  const resultStack = [];

  while (stack.length > 0) {
    const cmd = stack.pop();

    if (cmd.type === 'PROCESS') {
      const { term, visited } = cmd;
      if (!term) {
        resultStack.push(term);
        continue;
      }

      if (isVariable(term)) {
        const val = bindings[term.name];
        if (val !== undefined && val !== term) {
          if (!recursive || visited.has(term.name)) {
            resultStack.push(val);
          } else {
            const newVisited = new Set(visited).add(term.name);
            stack.push({ type: 'PROCESS', term: val, visited: newVisited });
          }
        } else {
          resultStack.push(term);
        }
        continue;
      }

      if (isExpression(term)) {
        if (isList(term)) {
          const { elements, tail } = flattenList(term);
          stack.push({
            type: 'CONSTRUCT_LIST',
            elemCount: elements.length,
            hasTail: !!tail,
            original: term,
          });
          if (tail) {
            stack.push({ type: 'PROCESS', term: tail, visited: new Set(visited) });
          }
          for (let i = elements.length - 1; i >= 0; i--) {
            stack.push({ type: 'PROCESS', term: elements[i], visited: new Set(visited) });
          }
          continue;
        }

        const op = term.operator;
        stack.push({
          type: 'CONSTRUCT_EXPR',
          original: term,
          compCount: term.components.length,
          opIsObj: typeof op === 'object',
        });
        for (let i = term.components.length - 1; i >= 0; i--) {
          stack.push({ type: 'PROCESS', term: term.components[i], visited: new Set(visited) });
        }
        if (typeof op === 'object') {
          stack.push({ type: 'PROCESS', term: op, visited });
        }
        continue;
      }

      resultStack.push(term);
      continue;
    }

    if (cmd.type === 'CONSTRUCT_EXPR') {
      const { original, compCount, opIsObj } = cmd;
      const items = resultStack.splice(
        resultStack.length - compCount - (opIsObj ? 1 : 0),
        compCount + (opIsObj ? 1 : 0)
      );
      let newOp = original.operator;
      if (opIsObj) {
        newOp = items.shift();
      }
      const changed =
        newOp !== original.operator || items.some((c, i) => c !== original.components[i]);
      resultStack.push(changed ? exp(newOp, items) : original);
      continue;
    }

    if (cmd.type === 'CONSTRUCT_LIST') {
      const { elemCount, hasTail, original } = cmd;
      const items = resultStack.splice(
        resultStack.length - elemCount - (hasTail ? 1 : 0),
        elemCount + (hasTail ? 1 : 0)
      );
      const newTail = hasTail ? items.pop() : undefined;
      const { elements: origElements, tail: origTail } = flattenList(original);
      const changed =
        newTail !== origTail ||
        items.length !== origElements.length ||
        items.some((e, i) => e !== origElements[i]);
      resultStack.push(changed ? constructList(items, newTail) : original);
    }
  }

  return resultStack[0];
};

const unifyLists = (t1, t2, bindings) => {
  const f1 = flattenList(t1);
  const f2 = flattenList(t2);
  const minLen = Math.min(f1.elements.length, f2.elements.length);

  let currBindings = bindings;
  for (let i = 0; i < minLen && currBindings; i++) {
    currBindings = unifiedUnify(f1.elements[i], f2.elements[i], currBindings);
  }
  if (!currBindings) {
    return null;
  }

  const t1Rem =
    f1.elements.length > minLen ? constructList(f1.elements.slice(minLen), f1.tail) : f1.tail;
  const t2Rem =
    f2.elements.length > minLen ? constructList(f2.elements.slice(minLen), f2.tail) : f2.tail;
  return unifiedUnify(t1Rem, t2Rem, currBindings);
};

const mettaAdapter = {
  isVariable,
  isCompound: isExpression,
  getVariableName: (t) => t.name,
  getOperator: (t) => t.operator,
  getComponents: (t) => t.components ?? [],
  equals: (t1, t2) => t1 === t2 || (t1?.equals?.(t2) ?? false),
  substitute: (t, b, opts) => safeSubstitute(t, b, undefined, opts?.recursive),
  reconstruct: (t, comps) => {
    if (isList(t)) {
      const { tail } = flattenList(t);
      return constructList(comps, tail);
    }
    return exp(t.operator, comps);
  },
  // Intercept compound unification to handle cons-list vs expression-form list matching
  preUnify: (t1, t2, bindings) => {
    // (: h t) pattern vs expression-form list (a b c)
    if (isList(t1) && isExpression(t2) && t2.operator?.name !== ':') {
      return unifiedUnify(t1, exprToCons(t2), bindings);
    }
    if (isList(t2) && isExpression(t1) && t1.operator?.name !== ':') {
      return unifiedUnify(exprToCons(t1), t2, bindings);
    }
    // (cons h t) in pattern acts as (: h t)
    if (isExpression(t1) && t1.operator?.name === 'cons' && t1.components?.length === 2) {
      return unifiedUnify(exp(sym(':'), t1.components), t2, bindings);
    }
    if (isExpression(t2) && t2.operator?.name === 'cons' && t2.components?.length === 2) {
      return unifiedUnify(t1, exp(sym(':'), t2.components), bindings);
    }
    return undefined; // proceed with standard unification
  },
};

// Convert expression-form list (a b c d) to cons-list (: a (: b (: c (: d ()))))
const exprToCons = (expr) => {
  if (!isExpression(expr) || expr.operator?.name === ':') return expr;
  const elements = [expr.operator, ...(expr.components ?? [])];
  let result = sym('()');
  for (let i = elements.length - 1; i >= 0; i--) {
    result = exp(sym(':'), [elements[i], result]);
  }
  return result;
};

// Recursively replace (cons h t) with (: h t) in patterns
const normalizeConsInPattern = (atom) => {
  if (!isExpression(atom)) return atom;
  if (atom.operator?.name === 'cons' && atom.components?.length === 2) {
    return exp(sym(':'), [
      normalizeConsInPattern(atom.components[0]),
      normalizeConsInPattern(atom.components[1]),
    ]);
  }
  const newOp = normalizeConsInPattern(atom.operator);
  const newComps = atom.components.map(normalizeConsInPattern);
  if (newOp === atom.operator && newComps.every((c, i) => c === atom.components[i])) return atom;
  return exp(newOp, newComps);
};

// Recursively convert expression-form lists to cons-lists in a term
// Only converts when the term is a list-like expression (not a function application)
const deepNormalizeExprToCons = (atom) => {
  if (!isExpression(atom)) return atom;
  if (atom.operator?.name === ':') {
    // Already a cons-list - normalize components
    return exp(sym(':'), atom.components.map(deepNormalizeExprToCons));
  }
  // Convert this expression to a cons-list
  return exprToCons(atom);
};

const unifiedUnify = (t1, t2, binds = {}) => {
  if (configManager.get('fastPaths')) {
    const tag1 = getTypeTag(t1),
      tag2 = getTypeTag(t2);
    if (tag1 === TYPE_SYMBOL && tag2 === TYPE_SYMBOL) {
      return t1 === t2 || t1.name === t2.name ? binds : null;
    }
  } else if (fastIsSymbol(t1) && fastIsSymbol(t2)) {
    return t1 === t2 || t1.name === t2.name ? binds : null;
  }

  // Handle cons constructor in patterns FIRST: (cons $h $t) acts as (: $h $t)
  // Must come BEFORE list-vs-expr conversion to prevent incorrect normalization
  if (isExpression(t1) && t1.operator?.name === 'cons' && t1.components?.length === 2) {
    return unifiedUnify(exp(sym(':'), t1.components), t2, binds);
  }
  if (isExpression(t2) && t2.operator?.name === 'cons' && t2.components?.length === 2) {
    return unifiedUnify(t1, exp(sym(':'), t2.components), binds);
  }

  if (isList(t1) && isList(t2)) {
    return unifyLists(t1, t2, binds);
  }

  // Handle cons pattern matching against expression-form lists:
  // If one side is a cons-list (: h t) and the other is a non-cons expression (a b c),
  // convert the expression to cons-list form and retry.
  if (isList(t1) && isExpression(t2) && t2.operator?.name !== ':') {
    return unifiedUnify(t1, exprToCons(t2), binds);
  }
  if (isList(t2) && isExpression(t1) && t1.operator?.name !== ':') {
    return unifiedUnify(exprToCons(t1), t2, binds);
  }

  const result = coreUnify(t1, t2, binds, mettaAdapter);

  if (!result && configManager.get('smt')) {
    const bridge = getSMTBridge();
    if (bridge?.canSolve(binds)) {
      const smtResult = bridge.solve([t1, t2]);
      if (smtResult) {
        return smtResult;
      }
    }
  }

  return result;
};

export const Unify = {
  unify: unifiedUnify,
  subst: (term, bindings, options) => safeSubstitute(term, bindings, undefined, options?.recursive),
  match: (pat, term, binds = {}) => coreUnify(pat, term, binds, mettaAdapter),
  matchAll: (pats, terms) => {
    const res = [];
    pats.forEach((p) =>
      terms.forEach((t) => {
        const b = unifiedUnify(p, t);
        if (b) {
          res.push({ pattern: p, term: t, bindings: b });
        }
      })
    );
    return res;
  },
  isVar: isVariable,
};
