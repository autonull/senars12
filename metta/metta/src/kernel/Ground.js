import { sym } from './Term.js';
import { configManager } from '../config/config.js';
import {
    CoreRegistry,
    OperationHelpers,
    registerArithmeticOps,
    registerBudgetOps,
    registerComparisonOps,
    registerExpressionOps,
    registerHOFOps,
    registerIOParser,
    registerIOOps,
    registerIntrospectionOps,
    registerListOps,
    registerLogicalOps,
    registerMathOps,
    registerMetaprogrammingOps,
    registerReflectionOps,
    registerSetOps,
    registerSpaceOps,
    registerStateOps,
    registerStringOps,
    registerTimeOps,
    registerTypeOps,
} from './ops/index.js';

const AsyncFunction = Object.getPrototypeOf(async function () {
}).constructor;
const isAsyncFunction = fn => fn instanceof AsyncFunction;

export class Ground extends CoreRegistry {
    #opsById = [];
    #nameToId = new Map();
    #nextId = 0;
    #fastPathsEnabled = configManager.get('fastPaths');

    constructor(context = {}) {
        super();
        this.context = context;
        this.opsById = this.#opsById;
        this.nameToId = this.#nameToId;
        this.nextId = this.#nextId;
        this._registerCoreOperations();
    }

    _atomToNum(atom) {
        return OperationHelpers.atomToNum(atom);
    }

    _requireNums(args, count = null) {
        return OperationHelpers.requireNums(args, count);
    }

    _bool(val) {
        return OperationHelpers.bool(val);
    }

    _truthy(val) {
        return OperationHelpers.truthy(val);
    }

    _flattenExpr(expr) {
        return OperationHelpers.flattenExpr(expr);
    }

    _listify(arr) {
        return OperationHelpers.listify(arr);
    }

    _isList(atom) {
        return OperationHelpers.isList(atom);
    }

    register(name, op, options = {}) {
        const normalizedOptions = {...options, async: options.async ?? isAsyncFunction(op)};
        super.register(name, op, normalizedOptions);

        if (this.#fastPathsEnabled) {
            const id = this.#nextId++;
            this.#nameToId.set(name, id);
            this.#opsById[id] = {op, options: normalizedOptions};
            if (op && typeof op === 'object') {
                op._opId = id;
                op._async = normalizedOptions.async;
            }
        }
    }

    lookup(symbol) {
        const name = symbol.name ?? symbol;
        if (this.#fastPathsEnabled) {
            if (symbol._opId !== undefined) {
                return this.#opsById[symbol._opId]?.op;
            }
            const id = this.#nameToId.get(name);
            if (id !== undefined) {
                return this.#opsById[id]?.op;
            }
        }
        return this.operations.get(this._normalize(name))?.fn;
    }

    get(name) {
        return this.lookup(typeof name === 'string' ? {name} : name);
    }

    getOptions(name) {
        const n = typeof name === 'string' ? name : name?.name;
        if (!n) {
            return {};
        }
        if (this.#fastPathsEnabled) {
            const id = this.#nameToId.get(n);
            if (id !== undefined) {
                return this.#opsById[id]?.options ?? {};
            }
        }
        return this.operations.get(this._normalize(n))?.options ?? {};
    }

    async executeAsync(name, ...args) {
        const n = typeof name === 'string' ? name : name?.name;
        if (!n) {
            throw new Error(`Invalid operation name: ${name}`);
        }
        const options = this.getOptions(n);
        const op = this.lookup({name: n});
        if (!op) {
            throw new Error(`Operation not found: ${n}`);
        }
        return options.async ? await op(...args) : op(...args);
    }

    isAsync(name) {
        return this.getOptions(name).async === true;
    }

    getOperationsWithMeta() {
        return [...this.operations.entries()].map(([name, entry]) => ({
            name,
            async: entry.options?.async ?? false,
            lazy: entry.options?.lazy ?? false,
            pure: entry.options?.pure ?? false
        }));
    }

    _registerCoreOperations() {
        this._registerBasicOps();
        this._registerAdvancedOps();
        this.register('&now', () => sym(String(Date.now())));
        this._registerPlaceholders();
        registerMetaprogrammingOps(this);
    }

    _registerBasicOps() {
        registerArithmeticOps(this);
        registerComparisonOps(this);
        registerLogicalOps(this);
        registerListOps(this);
        registerStringOps(this);
        registerIOOps(this);
        registerIOParser(this);
        registerTimeOps(this);
    }

    _registerAdvancedOps() {
        registerSpaceOps(this, this.context);
        registerStateOps(this);
        registerIntrospectionOps(this);
        registerTypeOps(this);
        registerBudgetOps(this);
        registerExpressionOps(this);
        registerMathOps(this);
        registerSetOps(this);
        registerHOFOps(this);
        registerReflectionOps(this);
    }

    _registerPlaceholders() {
        ['&subst', '&match', '&type-of'].forEach(op =>
            this.register(op, () => {
                throw new Error(`${op} should be provided by Interpreter`);
            })
        );
        // PeTTa control flow operations
        this.register('&cut', () => sym('()'));
        this.register('&once', (atom) => {
            // If atom is a cons-list, return first element; otherwise return as-is
            if (atom.operator?.name === ':' && atom.components?.length >= 1) {
                return atom.components[0];
            }
            return atom;
        });
    }
}
