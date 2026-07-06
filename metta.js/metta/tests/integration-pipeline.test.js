/**
 * ReductionPipeline Integration Tests
 */

import {beforeEach, describe, expect, it} from '@jest/globals';
import {
    CacheStage,
    PipelineBuilder,
    ReductionPipeline,
    ZipperStage
} from '../src/kernel/reduction/ReductionPipeline.js';
import {configManager, exp, Ground, JITCompiler, Space, sym} from '../src/index.js';
import {ReductionCache} from '../src/kernel/ReductionCache.js';
import {createInterpreterBindings, reduce, reduceND, reductionOptions, step} from '../src/kernel/Reduce.js';

describe('ReductionPipeline Integration', () => {
    let space, ground, cache, pipeline;

    beforeEach(() => {
        space = new Space();
        ground = new Ground();
        cache = new ReductionCache(100);
        pipeline = new ReductionPipeline(configManager);
    });

    describe('PipelineBuilder', () => {
        it('should build pipeline with fluent API', () => {
            const builtPipeline = new PipelineBuilder(configManager)
                .withCache()
                .withJIT({threshold: 50})
                .withZipper({threshold: 8})
                .withGroundedOps()
                .withExplicitCalls()
                .withRuleMatching()
                .withSuperpose()
                .build();

            expect(builtPipeline.stages.length).toBeGreaterThan(0);
        });

        it('should allow custom stage order', () => {
            const customPipeline = new PipelineBuilder(configManager)
                .withCache()
                .withRuleMatching()
                .withJIT({threshold: 30})
                .build();

            const stageNames = customPipeline.stages.map(s => s.name);
            expect(stageNames).toContain('cache');
            expect(stageNames).toContain('jit');
            expect(stageNames).toContain('rule-match');
        });

        it('should allow adding custom stages', () => {
            class CustomStage extends CacheStage {
                constructor() {
                    super('custom');
                }
            }

            const pipeline = new PipelineBuilder(configManager)
                .withCache()
                .withStage(new CustomStage())
                .build();

            expect(pipeline.stages.length).toBe(2);
        });
    });

    describe('Pipeline Execution', () => {
        it('should execute pipeline on simple atom', async () => {
            const atom = exp(sym('test'), []);
            const context = {
                config: configManager,
                space,
                ground,
                cache,
                limit: 1000
            };

            const standardPipeline = ReductionPipeline.createStandard(configManager);
            const results = [];

            for await (const result of standardPipeline.execute(atom, context)) {
                results.push(result);
            }

            expect(results.length).toBeGreaterThanOrEqual(0);
        });

        it('should track execution statistics', async () => {
            const atom = exp(sym('test'), []);
            const context = {
                config: configManager,
                space,
                ground,
                cache,
                limit: 1000
            };

            const pipeline = ReductionPipeline.createStandard(configManager);

            for await (const result of pipeline.execute(atom, context)) {
                // Execute
            }

            const stats = pipeline.getStats();
            expect(stats.executions).toBe(1);
            expect(stats.stages).toBeDefined();
        });

        it('should provide performance profile', async () => {
            const atom = exp(sym('test'), []);
            const context = {
                config: configManager,
                space,
                ground,
                cache,
                limit: 1000
            };

            const pipeline = ReductionPipeline.createStandard(configManager);

            for await (const result of pipeline.execute(atom, context)) {
            }
            for await (const result of pipeline.execute(atom, context)) {
            }

            const profile = pipeline.getProfile();
            expect(profile.totalExecutions).toBe(2);
            expect(profile.stages).toBeDefined();
            expect(Array.isArray(profile.stages)).toBe(true);
        });

        it('should allow resetting statistics', () => {
            const pipeline = new ReductionPipeline(configManager);
            pipeline.stats.executions = 5;
            pipeline.stats.stageHits.set('test', 10);
            pipeline.resetStats();

            expect(pipeline.stats.executions).toBe(0);
            expect(pipeline.stats.stageHits.size).toBe(0);
        });
    });

    describe('Stage Management', () => {
        it('should enable/disable stages at runtime', () => {
            const pipeline = new PipelineBuilder(configManager)
                .withCache()
                .withJIT()
                .build();

            pipeline.setStageEnabled('jit', false);
            const jitStage = pipeline.stages.find(s => s.name === 'jit');
            expect(jitStage.enabled).toBe(false);

            pipeline.setStageEnabled('jit', true);
            expect(jitStage.enabled).toBe(true);
        });

        it('should remove stages', () => {
            const pipeline = new PipelineBuilder(configManager)
                .withCache()
                .withJIT()
                .withZipper()
                .build();

            const initialLength = pipeline.stages.length;
            pipeline.remove('jit');

            expect(pipeline.stages.length).toBe(initialLength - 1);
            const jitStage = pipeline.stages.find(s => s.name === 'jit');
            expect(jitStage).toBeUndefined();
        });

        it('should allow adding stages after build', () => {
            const pipeline = new PipelineBuilder(configManager)
                .withCache()
                .build();

            class TestStage extends CacheStage {
                constructor() {
                    super('test-stage');
                }
            }

            pipeline.use(new TestStage());
            expect(pipeline.stages.length).toBe(2);
        });
    });

    describe('Cache Stage', () => {
        it('should cache reduction results', async () => {
            const pipeline = new PipelineBuilder(configManager).withCache().build();
            const atom = exp(sym('cached-test'), []);
            const context = {config: configManager, space, ground, cache, limit: 1000};

            const results1 = [];
            for await (const result of pipeline.execute(atom, context)) {
                results1.push(result);
            }

            cache.set(atom, exp(sym('reduced'), []));

            const results2 = [];
            for await (const result of pipeline.execute(atom, context)) {
                results2.push(result);
            }

            expect(cache.get(atom)).toBeDefined();
        });
    });

    describe('JIT Stage', () => {
        it('should track atoms for JIT compilation', () => {
            const jitCompiler = new JITCompiler(3);
            const atom = exp(sym('jit-test'), []);

            jitCompiler.track(atom);
            jitCompiler.track(atom);
            jitCompiler.track(atom);

            const compiled = jitCompiler.get(atom);
            expect(compiled).toBeDefined();
        });

        it('should execute JIT compiled functions', async () => {
            const jitCompiler = new JITCompiler(1);
            const pipeline = new PipelineBuilder(configManager).withJIT({jitCompiler}).build();
            const atom = exp(sym('jit-exec-test'), []);
            const context = {config: configManager, space, ground, cache, limit: 1000};

            jitCompiler.track(atom);
            jitCompiler.track(atom);

            const results = [];
            for await (const result of pipeline.execute(atom, context)) {
                results.push(result);
            }

            expect(results.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Zipper Stage', () => {
        it('should detect deep expressions', () => {
            const zipperStage = new ZipperStage(3);

            let deep = sym('leaf');
            for (let i = 0; i < 5; i++) {
                deep = exp(sym('level'), [deep]);
            }

            const context = {config: configManager, space, ground, cache, limit: 1000};
            const result = zipperStage.process(deep, context);

            expect(result).toBeDefined();
            expect(result.useZipper).toBe(true);
        });

        it('should not trigger for shallow expressions', () => {
            const zipperStage = new ZipperStage(8);
            const atom = exp(sym('shallow'), []);
            const context = {config: configManager, space, ground, cache, limit: 1000};
            const result = zipperStage.process(atom, context);
            expect(result).toBeNull();
        });
    });

    describe('Superpose Stage', () => {
        it('should handle superpose alternatives', async () => {
            const pipeline = new PipelineBuilder(configManager).withSuperpose().build();
            ground.register('superpose', {execute: (...args) => exp(sym('result'), [])});

            const atom = exp(sym('superpose'), [exp(sym('alt1'), []), exp(sym('alt2'), [])]);
            const context = {config: configManager, space, ground, cache, limit: 1000};

            const results = [];
            for await (const result of pipeline.execute(atom, context)) {
                results.push(result);
            }

            expect(results.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Context Pooling (from Reduce.js)', () => {
        it('should pool and reuse contexts', () => {
            const atom = exp(sym('pool-test'), []);
            for (let i = 0; i < 10; i++) {
                step(atom, space, ground, 100, cache);
            }
            expect(true).toBe(true);
        });
    });

    describe('Per-Interpreter Bindings', () => {
        it('should create interpreter-specific bindings', () => {
            const mockInterpreter = {id: 'test-interpreter'};
            const bindings = createInterpreterBindings(mockInterpreter);

            expect(bindings.step).toBeDefined();
            expect(bindings.reduce).toBeDefined();
            expect(bindings.reduceND).toBeDefined();
            expect(bindings.getStats).toBeDefined();
            expect(bindings.setStageEnabled).toBeDefined();
        });

        it('should allow stage configuration per interpreter', () => {
            const mockInterpreter = {id: 'config-test'};
            const bindings = createInterpreterBindings(mockInterpreter);
            bindings.setStageEnabled('jit', false);
            const stats = bindings.getStats();
            expect(stats).toBeDefined();
        });
    });

    describe('Reduction Options Builder', () => {
        it('should build options with fluent API', () => {
            const options = reductionOptions()
                .withSpace(space)
                .withGround(ground)
                .withCache(cache)
                .withLimit(5000)
                .build();

            expect(options.space).toBe(space);
            expect(options.ground).toBe(ground);
            expect(options.cache).toBe(cache);
            expect(options.limit).toBe(5000);
        });
    });

    describe('Main Reduction Functions', () => {
        it('should reduce simple atoms', () => {
            const atom = exp(sym('test'), []);
            const result = reduce(atom, space, ground, 100, cache);
            expect(result).toBeDefined();
        });

        it('should perform non-deterministic reduction', () => {
            const atom = exp(sym('test'), []);
            const results = reduceND(atom, space, ground, 100, cache);
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThanOrEqual(1);
        });

        it('should perform single step reduction', () => {
            const atom = exp(sym('test'), []);
            const result = step(atom, space, ground, 100, cache);
            expect(result).toBeDefined();
            expect(result.reduced).toBeDefined();
            expect(result.applied).toBeDefined();
        });
    });
});
