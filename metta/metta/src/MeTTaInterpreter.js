import {Logger} from '@senars/core/util/Logger.js';

const _factoryCache = new Map();
function createTermFactory() {
    return {
        atomic: (name) => {
            const key = String(name);
            if (_factoryCache.has(key)) return _factoryCache.get(key);
            const atom = {type: 'atom', name: key, operator: null};
            _factoryCache.set(key, atom);
            return atom;
        },
        clearCache: () => _factoryCache.clear(),
        stats: () => ({cacheSize: _factoryCache.size})
    };
}

import {ModuleLoader} from './kernel/ModuleLoader.js';
import {BaseMeTTaComponent} from './helpers/BaseMeTTaComponent.js';
import {Parser} from './Parser.js';
import {TypeChecker, TypeSystem} from './TypeSystem.js';
import {Ground} from './kernel/Ground.js';
import {MemoizationCache} from './kernel/MemoizationCache.js';
import {ReductionCache} from './kernel/ReductionCache.js';
import {
    match,
    reduce,
    reduceND,
    reduceNDAsync,
    setReduceConfig,
    setReduceNDInternalReference,
    step
} from './kernel/Reduce.js';
import {flattenList, isExpression, isList, Term} from './kernel/Term.js';
import {Formatter} from './kernel/Formatter.js';
import {configManager, ExtensionRegistry, registerMeTTaExtensions} from './config/index.js';
import {registerConfigOps} from './kernel/ops/StateOps.js';
import {ChannelExtension, NeuralBridge, ReactiveSpace} from './extensions/index.js';
import {loadStdlib} from './stdlib/StdlibLoader.js';
import {OperationHelpers} from './kernel/ops/index.js';
import {
    registerAdvancedOps,
    registerHofOps,
    registerMinimalOps,
    registerParallelOps,
    registerReactiveOps
} from './interp/index.js';



export class MeTTaInterpreter extends BaseMeTTaComponent {
    constructor(reasoner, options = {}) {
        if (reasoner && typeof reasoner === 'object' && !Object.keys(options).length) {
            options = reasoner;
            reasoner = null;
        }

        const opts = {maxReductionSteps: 1000, ...options};
        opts.termFactory ??= createTermFactory();

        super(opts, 'MeTTaInterpreter', opts.eventBus, opts.termFactory);

        this.reasoner = reasoner;
        this.space = new ReactiveSpace();
        this.spaces = new Map();
        this.moduleLoader = new ModuleLoader(this);
        this.ground = new Ground(this);
        this.parser = new Parser();
        this.typeSystem = new TypeSystem();
        this.typeChecker = new TypeChecker(this.typeSystem);
        this.memoCache = new MemoizationCache(opts.cacheCapacity || configManager.get('cacheCapacity'));
        this.reductionCache = new ReductionCache(opts.cacheCapacity || configManager.get('cacheCapacity'));
        this.extensionRegistry = new ExtensionRegistry(this);
        registerMeTTaExtensions(this.extensionRegistry);
        this._injectReductionDependencies();
        registerConfigOps(this.ground, this.config);
        this._initializeOperations();
        this._initializeBridge();
        this._initializeExtensions(options);
        this._loadStandardLibrary();
    }

    _injectReductionDependencies() {
        setReduceConfig(configManager);
        setReduceNDInternalReference(reduceND);
    }

    _initializeOperations() {
        for (const registerFn of [registerAdvancedOps, registerReactiveOps, registerParallelOps, registerMinimalOps, registerHofOps]) {
            registerFn(this);
        }
    }

    async _initializeExtensions(options) {
        if (options.embodimentBus) {
            new ChannelExtension(this, options.embodimentBus, {
                channelFactories: options.channelFactories ?? {},
                toolFactories: options.toolFactories ?? {},
            }).register();
        }

        const extensionsToLoad = [
            configManager.get('tensor') && 'neural-bridge',
            configManager.get('smt') && 'smt-bridge',
            configManager.get('debugging') && 'visual-debugger'
        ].filter(Boolean);

        extensionsToLoad.length && await this.extensionRegistry.loadAll(extensionsToLoad);

    }

    _initializeBridge() {
        const bridge = this.reasoner?.bridge ?? configManager.get('bridge');
        bridge?.registerPrimitives?.(this.ground);

        if (configManager.get('tensor') && !this.extensionRegistry.isLoaded('neural-bridge')) {
            NeuralBridge.register(this.ground);
        }
    }

    _loadStandardLibrary() {
        if (configManager.get('loadStdlib') !== false) {
            try {
                loadStdlib(this, this.config);
            } catch (e) {
                throw new Error(`Stdlib failed to load: ${e.message}\n${e.stack}`);
            }
        }
    }

    _listify(arr) {
        let list = Term.sym('()');
        for (let i = arr.length - 1; i >= 0; i--) {
            list = Term.exp(':', [arr[i], list]);
        }
        return list;
    }

    _extractLetStarPairs(bindings) {
        if (bindings.operator?.name === ':') {
            return flattenList(bindings).elements;
        }
        if (bindings.type === 'compound') {
            return [bindings.operator, ...bindings.components];
        }
        if (bindings.name !== '()') {
            Logger.error('Invalid &let* bindings', bindings);
        }
        return [];
    }

    _extractVarAndValue(binding) {
        return binding.operator?.name === ':' ? binding.components : [binding.operator, binding.components[0]];
    }

    _flattenToList(atom) {
        if (!atom || atom.name === '()') {
            return [];
        }
        if (isList(atom)) {
            return flattenList(atom).elements;
        }
        if (isExpression(atom)) {
            return [atom.operator, ...atom.components];
        }
        return [atom];
    }

    _truthy(atom) {
        return OperationHelpers.truthy(atom);
    }

    run(code) {
        return this.trackOperation('run', () => this.#processProgramSync(code));
    }

    async runAsync(code) {
        return this.trackOperation('run', async () => this.#processProgramAsync(code));
    }

    #processExpressions(exprs) {
        const res = [];
        for (let i = 0; i < exprs.length; i++) {
            const e = exprs[i];
            if (e.name === '!' && i + 1 < exprs.length) {
                const evalRes = this.evaluate(exprs[++i]);
                if (Array.isArray(evalRes)) {
                    res.push(...evalRes);
                } else if (evalRes != null) {
                    res.push(evalRes);
                }
                continue;
            }
            // Rules and type annotations: add to space
            const isRule = (e.operator === '=' || e.operator?.name === '=') && e.components?.length === 2;
            const isTypeAnnotation = (e.operator === ':' || e.operator?.name === ':') && e.components?.length === 2;
            if (isRule) { this.space.addRule(e.components[0], e.components[1]); res.push(e); continue; }
            if (isTypeAnnotation) { this.space.add(e); res.push(e); continue; }
            // Bare expressions: add to space as facts AND evaluate
            this.space.add(e);
            const evalRes = this.evaluate(e);
            if (Array.isArray(evalRes)) {
                res.push(...evalRes);
            } else if (evalRes != null) {
                res.push(evalRes);
            } else {
                res.push(e);
            }
        }
        res.toString = () => Formatter.formatResult(res);
        return res;
    }

    async #processExpressionsAsync(exprs) {
        const res = [];
        for (let i = 0; i < exprs.length; i++) {
            const e = exprs[i];
            if (e.name === '!' && i + 1 < exprs.length) {
                const evalRes = await this.evaluateAsync(exprs[++i]);
                if (Array.isArray(evalRes)) {
                    res.push(...evalRes);
                } else if (evalRes != null) {
                    res.push(evalRes);
                }
                continue;
            }
            // Rules and type annotations: add to space
            const isRule = (e.operator === '=' || e.operator?.name === '=') && e.components?.length === 2;
            const isTypeAnnotation = (e.operator === ':' || e.operator?.name === ':') && e.components?.length === 2;
            if (isRule) { this.space.addRule(e.components[0], e.components[1]); res.push(e); continue; }
            if (isTypeAnnotation) { this.space.add(e); res.push(e); continue; }
            // Bare expressions: add to space as facts AND evaluate
            this.space.add(e);
            const evalRes = await this.evaluateAsync(e);
            if (Array.isArray(evalRes)) {
                res.push(...evalRes);
            } else if (evalRes != null) {
                res.push(evalRes);
            } else {
                res.push(e);
            }
        }
        res.toString = () => Formatter.formatResult(res);
        return res;
    }

    #processProgramSync(code) {
        return this.#processExpressions(this.parser.parseProgram(code));
    }

    async #processProgramAsync(code) {
        return this.#processExpressionsAsync(this.parser.parseProgram(code));
    }

    load(code) {
        return this.parser.parseProgram(code).map(e => {
            this._processExpression(e, null);
            return {term: e};
        });
    }

    _processExpression(expr, results) {
        const isRule = (expr.operator === '=' || expr.operator?.name === '=') && expr.components?.length === 2;
        const isTypeAnnotation = (expr.operator === ':' || expr.operator?.name === ':') && expr.components?.length === 2;

        if (isRule) {
            this.space.addRule(expr.components[0], expr.components[1]);
            results?.push(expr);
            return;
        }

        if (isTypeAnnotation) {
            this.space.add(expr);
            results?.push(expr);
            return;
        }

        if (!results) {
            this.space.add(expr);
            return;
        }

        const evalRes = this.evaluate(expr);
        results.push(...(Array.isArray(evalRes) ? evalRes : [evalRes]));
    }

    evaluate(atom) {
        return this.trackOperation('evaluate', () => {
            const res = reduceND(atom, this.space, this.ground, configManager.get('maxReductionSteps'), this.reductionCache, this);
            const steps = this.getMeTTaMetrics()[`${this._name}.evaluate`]?.count ?? 0;
            this.setMetric('reductionSteps', steps + 1);
            return res;
        });
    }

    async evaluateAsync(atom) {
        return this.trackOperation('evaluate', async () => {
            const res = await reduceNDAsync(atom, this.space, this.ground, configManager.get('maxReductionSteps'), this.reductionCache, this);
            const steps = this.getMeTTaMetrics()[`${this._name}.evaluate`]?.count ?? 0;
            this.setMetric('reductionSteps', steps + 1);
            return res;
        });
    }

    _reduceDeterministic(atom) {
        return reduce(atom, this.space, this.ground, configManager.get('maxReductionSteps'), this.reductionCache, this);
    }

    step(atom) {
        return step(atom, this.space, this.ground, configManager.get('maxReductionSteps'), this.reductionCache, this);
    }

    query(pattern, template) {
        const p = typeof pattern === 'string' ? this.parser.parse(pattern) : pattern;
        const t = typeof template === 'string' ? this.parser.parse(template) : template;
        const res = match(this.space, p, t);
        res.toString = () => Formatter.formatResult(res);
        return res;
    }

    getStats() {
        return {
            space: this.space.getStats(),
            groundedAtoms: {count: this.ground.getOperations().length},
            reductionEngine: {maxSteps: configManager.get('maxReductionSteps') || 10000},
            typeSystem: {
                count: this.typeSystem ? 1 : 0,
                typeVariables: this.typeSystem?.nextTypeVarId ?? 0
            },
            groundOps: this.ground.getOperations().length,
            reductionCache: this.reductionCache.stats(),
            ...super.getStats()
        };
    }
}
