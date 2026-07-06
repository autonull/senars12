import {beforeEach, describe, expect, test} from '@jest/globals';
import {AdamOptimizer, RMSpropOptimizer, SGDOptimizer} from '@senars/tensor/src/Optimizer.js';
import {Tensor} from '@senars/tensor/src/Tensor.js';
import {NativeBackend} from '@senars/tensor/src/backends/NativeBackend.js';

describe('Optimizers', function () {
    let backend;

    beforeEach(function () {
        backend = new NativeBackend();
    });

    describe('SGDOptimizer', function () {
        test('updates parameters with learning rate', function () {
            const optimizer = new SGDOptimizer(0.1);
            const param = new Tensor([1, 2, 3], {requiresGrad: true, backend});
            param.grad = new Tensor([0.5, 1.0, 1.5], {backend});

            const originalData = param.data.slice();
            const params = new Map([['w', param]]);
            optimizer.step(params);

            expect(param.data[0]).toBeCloseTo(0.95);
            expect(param.data[1]).toBeCloseTo(1.9);
            expect(param.data[2]).toBeCloseTo(2.85);
        });

        test('SGD with momentum', function () {
            const optimizer = new SGDOptimizer(0.1, 0.9);
            const param = new Tensor([1], {requiresGrad: true, backend});
            const params = new Map([['w', param]]);

            param.grad = new Tensor([1], {backend});
            optimizer.step(params);
            expect(param.data[0]).toBeCloseTo(0.9);

            param.grad = new Tensor([1], {backend});
            optimizer.step(params);
            expect(param.data[0]).toBeCloseTo(0.71);
        });

        test('skips parameters without gradients', function () {
            const optimizer = new SGDOptimizer(0.1);
            const param = new Tensor([1, 2, 3], {requiresGrad: false, backend});
            const params = new Map([['w', param]]);

            optimizer.step(params);

            expect(param.data).toEqual([1, 2, 3]);
        });
    });

    describe('AdamOptimizer', function () {
        test('updates parameters with adaptive learning rate', function () {
            const optimizer = new AdamOptimizer(0.001);
            const param = new Tensor([1, 2], {requiresGrad: true, backend});
            param.grad = new Tensor([0.5, 1.0], {backend});

            const params = new Map([['w', param]]);
            optimizer.step(params);

            expect(param.data[0]).toBeLessThan(1);
            expect(param.data[1]).toBeLessThan(2);
        });

        test('Adam with multiple steps', function () {
            const optimizer = new AdamOptimizer(0.01);
            const param = new Tensor([1], {requiresGrad: true, backend});
            const params = new Map([['w', param]]);

            for (let i = 0; i < 5; i++) {
                param.grad = new Tensor([1], {backend});
                optimizer.step(params);
            }

            expect(param.data[0]).toBeLessThan(1);
        });

        test('Adam handles different gradient magnitudes', function () {
            const optimizer = new AdamOptimizer(0.001);
            const param1 = new Tensor([1], {requiresGrad: true, backend});
            const param2 = new Tensor([1], {requiresGrad: true, backend});

            param1.grad = new Tensor([0.1], {backend});
            param2.grad = new Tensor([10], {backend});

            const params = new Map([['w1', param1], ['w2', param2]]);
            optimizer.step(params);

            expect(param1.data[0]).toBeLessThan(1);
            expect(param2.data[0]).toBeLessThan(1);
        });
    });

    describe('RMSpropOptimizer', function () {
        test('updates parameters with RMSprop', function () {
            const optimizer = new RMSpropOptimizer(0.01);
            const param = new Tensor([1, 2], {requiresGrad: true, backend});
            param.grad = new Tensor([0.5, 1.0], {backend});

            const params = new Map([['w', param]]);
            optimizer.step(params);

            expect(param.data[0]).toBeLessThan(1);
            expect(param.data[1]).toBeLessThan(2);
        });

        test('RMSprop accumulates squared gradients', function () {
            const optimizer = new RMSpropOptimizer(0.01, 0.9);
            const param = new Tensor([1], {requiresGrad: true, backend});
            const params = new Map([['w', param]]);

            for (let i = 0; i < 3; i++) {
                param.grad = new Tensor([1], {backend});
                const before = param.data[0];
                optimizer.step(params);
                const stepSize = Math.abs(param.data[0] - before);
                expect(stepSize).toBeGreaterThan(0);
            }

            expect(param.data[0]).toBeLessThan(1);
        });
    });

    describe('Common Optimizer Behaviors', function () {
        const optimizers = [
            {name: 'SGD', factory: () => new SGDOptimizer(0.01)},
            {name: 'Adam', factory: () => new AdamOptimizer(0.01)},
            {name: 'RMSprop', factory: () => new RMSpropOptimizer(0.01)}
        ];

        test.each(optimizers)('$name updates parameters', function ({factory}) {
            const optimizer = factory();
            const param = new Tensor([1, 2], {requiresGrad: true, backend});
            param.grad = new Tensor([0.5, 1.0], {backend});

            const params = new Map([['w', param]]);
            optimizer.step(params);

            expect(param.data[0]).toBeLessThan(1);
            expect(param.data[1]).toBeLessThan(2);
        });

        test.each(optimizers)('$name handles missing gradients', function ({factory}) {
            const optimizer = factory();
            const param = new Tensor([1, 2, 3], {requiresGrad: false, backend});
            const params = new Map([['w', param]]);

            optimizer.step(params);
            expect(param.data).toEqual([1, 2, 3]);
        });
    });

    describe('zeroGrad', function () {

        test('clears gradients for all parameters', function () {
            const optimizer = new SGDOptimizer(0.1);
            const param1 = new Tensor([1], {requiresGrad: true, backend});
            const param2 = new Tensor([2], {requiresGrad: true, backend});

            param1.grad = new Tensor([1], {backend});
            param2.grad = new Tensor([2], {backend});

            const params = new Map([['w1', param1], ['w2', param2]]);
            optimizer.zeroGrad(params);

            expect(param1.grad).toBeNull();
            expect(param2.grad).toBeNull();
        });
    });

    describe('training simulation', function () {
        test('SGD converges on simple linear problem', function () {
            // y = 2x + 1, learn from multiple points
            const optimizer = new SGDOptimizer(0.05);
            const w = new Tensor([0.5], {requiresGrad: true, backend});
            const b = new Tensor([0.5], {requiresGrad: true, backend});

            // Training data: x=[1,2,3,4], y=[3,5,7,9]
            const xs = [[1], [2], [3], [4]];
            const ys = [[3], [5], [7], [9]];

            const params = new Map([['w', w], ['b', b]]);

            for (let epoch = 0; epoch < 100; epoch++) {
                for (let i = 0; i < xs.length; i++) {
                    optimizer.zeroGrad(params);

                    const x = new Tensor(xs[i], {backend});
                    const yTrue = new Tensor(ys[i], {backend});
                    const wx = backend.mul(w, x);
                    const yPred = backend.add(wx, b);
                    const diff = backend.sub(yPred, yTrue);
                    const loss = backend.mul(diff, diff);

                    loss.backward();
                    optimizer.step(params);
                }
            }

            expect(w.data[0]).toBeCloseTo(2, 0);
            expect(b.data[0]).toBeCloseTo(1, 0);
        });
    });
});
