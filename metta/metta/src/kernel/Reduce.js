import {
    CacheStage,
    ExplicitCallStage,
    GroundedOpStage,
    JITCompiler,
    JITStage,
    ReductionPipeline,
    RuleMatchStage,
    SuperposeStage,
    ZipperStage
} from './reduction/index.js';
import {Unify} from './Unify.js';
import {configManager} from '../config/config.js';

const contextPool = [];
const CONTEXT_POOL_SIZE = 100;

const acquireContext = (space, ground, limit, cache, reduceND, interpreter = null) => {
    const ctx = contextPool.pop() ?? {};
    ctx.config = configManager;
    ctx.space = space;
    ctx.ground = ground;
    ctx.limit = limit;
    ctx.steps = 0;
    ctx.cache = cache;
    ctx.Unify = Unify;
    ctx.reduceND = reduceND;
    ctx.interpreter = interpreter;
    ctx._metrics = {stages: new Map(), startTime: Date.now()};
    return ctx;
};

const releaseContext = (ctx) => {
    if (contextPool.length < CONTEXT_POOL_SIZE) {
        ctx._metrics.stages.clear();
        ctx.steps = 0;
        contextPool.push(ctx);
    }
};

const pipelineRegistry = new WeakMap();

const getOrCreatePipeline = (interpreter, customStages = null) => {
    if (customStages) {
        const pipeline = new ReductionPipeline(configManager);
        for (const stage of customStages) {
            pipeline.use(stage);
        }
        pipelineRegistry.set(interpreter, pipeline);
        return pipeline;
    }

    let pipeline = pipelineRegistry.get(interpreter);
    if (!pipeline) {
        pipeline = ReductionPipeline.createStandard(configManager, new JITCompiler(configManager.get('jitThreshold')));
        pipelineRegistry.set(interpreter, pipeline);
    }
    return pipeline;
};

let globalPipeline = null;
let globalReduceND = null;

const getGlobalPipeline = () => globalPipeline ??= ReductionPipeline.createStandard(configManager, new JITCompiler(configManager.get('jitThreshold')));

export function resetGlobalPipeline() {
    globalPipeline = null;
    globalReduceND = null;
}

export function setReduceNDInternalReference(reduceFn) {
    globalReduceND = reduceFn;
}

export function setReduceConfig(_configOrManager) {
}

export function reductionOptions() {
    return {
        limit: 10000, cache: null, space: null, ground: null,
        withCache(cache) {
            this.cache = cache;
            return this;
        },
        withSpace(space) {
            this.space = space;
            return this;
        },
        withGround(ground) {
            this.ground = ground;
            return this;
        },
        withLimit(limit) {
            this.limit = limit;
            return this;
        },
        build() {
            return {...this};
        }
    };
}

export function step(atom, space, ground, limit = 10000, cache = null, interpreter = null) {
    const ctx = acquireContext(space, ground, limit, cache, globalReduceND, interpreter);
    try {
        const pl = getGlobalPipeline();
        const {value, done} = pl.execute(atom, ctx).next();
        if (!done && value) {
            return value.deadEnd
                ? {reduced: {operator: atom.operator ?? atom, components: []}, applied: true, deadEnd: true}
                : value;
        }
        return {reduced: atom, applied: false};
    } finally {
        releaseContext(ctx);
    }
}

export function* stepYield(atom, space, ground, limit = 10000, cache = null) {
    const ctx = acquireContext(space, ground, limit, cache, globalReduceND);
    try {
        yield* getGlobalPipeline().execute(atom, ctx);
    } finally {
        releaseContext(ctx);
    }
}

export function reduce(atom, space, ground, limit = 10000, cache = null, interpreter = null) {
    const ctx = acquireContext(space, ground, limit, cache, globalReduceND, interpreter);
    try {
        const pl = interpreter ? getOrCreatePipeline(interpreter) : getGlobalPipeline();
        let current = atom;
        while (ctx.steps < limit) {
            const {value, done} = pl.execute(current, ctx).next();
            if (done || !value?.applied) {
                return current;
            }
            current = value.reduced;
            ctx.steps++;
        }
        throw new Error(`Max steps exceeded: ${limit} steps`);
    } finally {
        releaseContext(ctx);
    }
}

export function reduceND(atom, space, ground, limit = 10000, cache = null, interpreter = null) {
    const ctx = acquireContext(space, ground, limit, cache, globalReduceND, interpreter);
    try {
        const results = [];
        const pl = getGlobalPipeline();
        const initialResults = [];

        for (const result of pl.execute(atom, ctx)) {
            if (result.applied) {
                if (result.deadEnd) {
                    return [];
                }
                initialResults.push(result.reduced);
            }
        }

        for (const initial of initialResults) {
            let current = initial;
            let reduced = true;
            while (reduced && ctx.steps < limit) {
                reduced = false;
                for (const result of pl.execute(current, ctx)) {
                    if (result.applied && !result.deadEnd) {
                        current = result.reduced;
                        reduced = true;
                        ctx.steps++;
                        break;
                    }
                }
            }
            results.push(current);
        }

        return results.length > 0 ? results : [atom];
    } finally {
        releaseContext(ctx);
    }
}

export function* reduceNDGenerator(atom, space, ground, limit = 10000, cache = null) {
    const ctx = acquireContext(space, ground, limit, cache, globalReduceND);
    try {
        for (const result of getGlobalPipeline().execute(atom, ctx)) {
            if (result.applied) {
                yield result.reduced;
            }
        }
    } finally {
        releaseContext(ctx);
    }
}

export async function stepAsync(atom, space, ground, limit, cache) {
    await Promise.resolve();
    return step(atom, space, ground, limit, cache);
}

export async function reduceAsync(atom, space, ground, limit = 10000, cache = null, interpreter = null) {
    const ctx = acquireContext(space, ground, limit, cache, globalReduceND, interpreter);
    try {
        const pl = interpreter ? getOrCreatePipeline(interpreter) : getGlobalPipeline();
        let current = atom;
        while (ctx.steps < limit) {
            if (ctx.steps % 100 === 0) {
                await Promise.resolve();
            }
            const {value, done} = pl.execute(current, ctx).next();
            if (done || !value?.applied) {
                return current;
            }
            current = value.reduced;
            ctx.steps++;
        }
        throw new Error(`Max steps exceeded: ${limit} steps`);
    } finally {
        releaseContext(ctx);
    }
}

export async function reduceNDAsync(atom, space, ground, limit = 10000, cache = null, interpreter = null) {
    const ctx = acquireContext(space, ground, limit, cache, globalReduceND, interpreter);
    try {
        const results = [];
        const pl = interpreter ? getOrCreatePipeline(interpreter) : getGlobalPipeline();
        const initialResults = [];

        // Phase 1: collect initial reductions
        for await (const result of pl.executeAsync(atom, ctx)) {
            if (result.applied) {
                if (result.deadEnd) {
                    return [];
                }
                initialResults.push(result.reduced);
            }
        }

        // Phase 2: feed each result back until exhaustion
        for (const initial of initialResults) {
            let current = initial;
            let reduced = true;
            while (reduced && ctx.steps < limit) {
                reduced = false;
                for await (const result of pl.executeAsync(current, ctx)) {
                    if (result.applied && !result.deadEnd) {
                        current = result.reduced;
                        reduced = true;
                        ctx.steps++;
                        break;
                    }
                }
            }
            results.push(current);
        }

        return results.length > 0 ? results : [atom];
    } finally {
        releaseContext(ctx);
    }
}

export function match(space, pattern, template) {
    const res = [];
    for (const cand of space.all()) {
        const bind = Unify.unify(pattern, cand);
        if (bind) {
            res.push(Unify.subst(template, bind));
        }
    }
    return res;
}

export function isGroundedCall(atom, ground) {
    if (!atom?.type || atom.type !== 'compound') {
        return false;
    }
    if (atom.operator?.name !== '^') {
        return false;
    }
    const {components} = atom;
    if (!components || components.length < 2) {
        return false;
    }
    const opSymbol = components[0];
    return opSymbol?.name != null && ground.has(opSymbol.name);
}

export function createInterpreterBindings(interpreter, customStages = null) {
    const pipeline = getOrCreatePipeline(interpreter, customStages);
    let reduceND = null;

    return {
        setReduceND(fn) {
            reduceND = fn;
            return this;
        },

        step(atom, space, ground, limit, cache) {
            const ctx = acquireContext(space, ground, limit, cache, reduceND);
            try {
                const {value, done} = pipeline.execute(atom, ctx).next();
                if (!done) {
                    return value.deadEnd
                        ? {reduced: {operator: atom.operator ?? atom, components: []}, applied: true, deadEnd: true}
                        : value;
                }
                return {reduced: atom, applied: false};
            } finally {
                releaseContext(ctx);
            }
        },

        reduce(atom, space, ground, limit, cache) {
            const ctx = acquireContext(space, ground, limit, cache, reduceND);
            try {
                let current = atom;
                let steps = 0;
                while (steps < limit) {
                    const {value, done} = pipeline.execute(current, ctx).next();
                    if (done || !value?.applied) {
                        return current;
                    }
                    current = value.reduced;
                    steps++;
                }
                throw new Error(`Max steps exceeded: ${limit} steps`);
            } finally {
                releaseContext(ctx);
            }
        },

        reduceND(atom, space, ground, limit, cache) {
            const ctx = acquireContext(space, ground, limit, cache, reduceND);
            try {
                const results = [];
                for (const result of pipeline.execute(atom, ctx)) {
                    if (result.applied) {
                        results.push(result.reduced);
                    }
                }
                return results.length > 0 ? results : [atom];
            } finally {
                releaseContext(ctx);
            }
        },

        getStats() {
            return pipeline.getStats();
        },
        setStageEnabled(stageName, enabled) {
            pipeline.setStageEnabled(stageName, enabled);
            return this;
        },
        addStage(stage) {
            pipeline.use(stage);
            return this;
        }
    };
}

export {
    ReductionPipeline, CacheStage, JITStage, ZipperStage,
    GroundedOpStage, ExplicitCallStage, RuleMatchStage, SuperposeStage
};
export {contextPool, pipelineRegistry, getGlobalPipeline, getOrCreatePipeline};
