export const TypeConstructors = {
    Base: (name) => ({kind: 'Base', name}),
    Arrow: (from, to) => ({kind: 'Arrow', from, to}),
    List: (element) => ({kind: 'List', element}),
    Maybe: (type) => ({kind: 'Maybe', type}),
    Either: (left, right) => ({kind: 'Either', left, right}),
    Vector: (length) => ({kind: 'Vector', length}),
    Fin: (n) => ({kind: 'Fin', n}),
    TypeVar: (index) => ({kind: 'TypeVar', index}),
    Forall: (varName, type) => ({kind: 'Forall', varName, type}),
    TypeCtor: (name, params = []) => ({kind: 'TypeCtor', name, params})
};

const BaseTypes = {
    Number: TypeConstructors.Base('Number'),
    String: TypeConstructors.Base('String'),
    Bool: TypeConstructors.Base('Bool'),
    Atom: TypeConstructors.Base('Atom')
};
Object.assign(TypeConstructors, BaseTypes);

export class TypeSystem {
    #typeRegistry = new Map(Object.entries(BaseTypes).map(([k, v]) => [k, v]));
    #substitution = new Map();
    #nextTypeVarId = 0;

    get substitution() {
        return this.#substitution;
    }

    set substitution(v) {
        this.#substitution = v;
    }

    get nextTypeVarId() {
        return this.#nextTypeVarId;
    }

    set nextTypeVarId(v) {
        this.#nextTypeVarId = v;
    }

    freshTypeVar() {
        return TypeConstructors.TypeVar(this.#nextTypeVarId++);
    }

    inferType(term, context = {}) {
        if (!term) {
            return this.freshTypeVar();
        }
        if (term.type === 'atom') {
            return this._inferAtomType(term, context);
        }
        if (term.type === 'compound' && term.operator) {
            return this._inferCompoundType(term, context);
        }
        return this.freshTypeVar();
    }

    _inferAtomType(term, context) {
        if (term.name?.match(/^[?$]/)) {
            return context[term.name.substring(1)] ?? this.freshTypeVar();
        }
        if (term.name) {
            if (!isNaN(parseFloat(term.name))) {
                return TypeConstructors.Number;
            }
            if (/^(True|False|true|false)$/.test(term.name)) {
                return TypeConstructors.Bool;
            }
            if (term.name.startsWith('"')) {
                return TypeConstructors.String;
            }
            return TypeConstructors.Atom;
        }
        return this.freshTypeVar();
    }

    _inferCompoundType(term, context) {
        const opType = this.inferType(term.operator, context);
        const argTypes = term.components.map(arg => this.inferType(arg, context));
        if (opType.kind === 'Arrow' && argTypes.length === 1 && this.unifyTypes(argTypes[0], opType.from)) {
            return opType.to;
        }
        return this.freshTypeVar();
    }

    checkType(term, expectedType, context = {}) {
        return this.unifyTypes(this.inferType(term, context), expectedType);
    }

    unifyTypes(t1, t2) {
        if (t1 === t2) {
            return true;
        }
        if (t1.kind === 'TypeVar') {
            return this.bindTypeVar(t1, t2);
        }
        if (t2.kind === 'TypeVar') {
            return this.bindTypeVar(t2, t1);
        }
        if (t1.kind !== t2.kind) {
            return false;
        }
        return this._unifyByKind(t1, t2);
    }

    _unifyByKind(t1, t2) {
        switch (t1.kind) {
            case 'Base':
                return t1.name === t2.name;
            case 'Arrow':
                return this.unifyTypes(t1.from, t2.from) && this.unifyTypes(t1.to, t2.to);
            case 'List':
                return this.unifyTypes(t1.element, t2.element);
            case 'TypeCtor':
                return t1.name === t2.name &&
                    t1.params.length === t2.params.length &&
                    t1.params.every((p, i) => this.unifyTypes(p, t2.params[i]));
            default:
                return false;
        }
    }

    bindTypeVar(v, t) {
        if (this.occursCheck(v, t)) {
            return false;
        }
        this.#substitution.set(v.index, t);
        return true;
    }

    occursCheck(v, t) {
        if (t.kind === 'TypeVar') {
            return t.index === v.index;
        }
        if (t.kind === 'Arrow') {
            return this.occursCheck(v, t.from) || this.occursCheck(v, t.to);
        }
        if (t.kind === 'List') {
            return this.occursCheck(v, t.element);
        }
        if (t.kind === 'TypeCtor') {
            return t.params.some(p => this.occursCheck(v, p));
        }
        return false;
    }

    applySubstitution(type) {
        if (type.kind === 'TypeVar') {
            const subst = this.#substitution.get(type.index);
            return subst ? this.applySubstitution(subst) : type;
        }
        return this._applySubstitutionByKind(type);
    }

    _applySubstitutionByKind(type) {
        switch (type.kind) {
            case 'Arrow':
                return TypeConstructors.Arrow(this.applySubstitution(type.from), this.applySubstitution(type.to));
            case 'List':
                return TypeConstructors.List(this.applySubstitution(type.element));
            case 'TypeCtor':
                return TypeConstructors.TypeCtor(type.name, type.params.map(p => this.applySubstitution(p)));
            default:
                return type;
        }
    }

    generateConstraints(term, context = {}) {
        if (term.type !== 'compound' || !term.operator) {
            return [];
        }

        const funcType = this.inferType(term.operator, context);
        const resultType = this.freshTypeVar();

        const constraints = term.components.map(arg => ({
            type1: funcType,
            type2: TypeConstructors.Arrow(this.inferType(arg, context), resultType)
        }));

        constraints.push({type1: this.inferType(term, context), type2: resultType});
        return constraints;
    }

    solveConstraints(constraints) {
        return constraints.every(c => this.unifyTypes(c.type1, c.type2));
    }

    inferWithConstraints(term, context = {}) {
        const constraints = this.generateConstraints(term, context);
        if (!this.solveConstraints(constraints)) {
            throw new Error(`Type inference failed: ${term.toString()}`);
        }
        return this.applySubstitution(this.inferType(term, context));
    }

    typeToString(type) {
        if (!type) {
            return 'Unknown';
        }
        return this._typeToStringByKind(type);
    }

    _typeToStringByKind(type) {
        switch (type.kind) {
            case 'Base':
                return type.name;
            case 'Arrow':
                return `(${this.typeToString(type.from)} -> ${this.typeToString(type.to)})`;
            case 'List':
                return `(List ${this.typeToString(type.element)})`;
            case 'Maybe':
                return `(Maybe ${this.typeToString(type.type)})`;
            case 'Either':
                return `(Either ${this.typeToString(type.left)} ${this.typeToString(type.right)})`;
            case 'Vector':
                return `(Vector ${type.length})`;
            case 'Fin':
                return `(Fin ${type.n})`;
            case 'TypeVar':
                return `t${type.index}`;
            case 'Forall':
                return `(forall ${type.varName} ${this.typeToString(type.type)})`;
            case 'TypeCtor': {
                const params = type.params.map(p => this.typeToString(p)).join(' ');
                return `(${type.name}${params ? ` ${params}` : ''})`;
            }
            default:
                return 'Unknown';
        }
    }
}

export class TypeChecker {
    #typeSystem;

    constructor(typeSystem) {
        this.#typeSystem = typeSystem ?? new TypeSystem();
    }

    infer(term, context = {}) {
        return this.#typeSystem.inferWithConstraints(term, context);
    }

    check(term, expectedType, context = {}) {
        return this.#typeSystem.checkType(term, expectedType, context);
    }

    unify(type1, type2) {
        const temp = new TypeSystem();
        temp.substitution = new Map(this.#typeSystem.substitution);
        temp.nextTypeVarId = this.#typeSystem.nextTypeVarId;
        return temp.unifyTypes(type1, type2) ? temp.substitution : null;
    }

    typeToString(type) {
        return this.#typeSystem.typeToString(type);
    }
}