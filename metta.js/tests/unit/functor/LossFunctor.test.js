import {beforeEach, describe, expect, test} from '@jest/globals';
import {LossFunctor} from '@senars/tensor/src/LossFunctor.js';
import {Tensor} from '@senars/tensor/src/Tensor.js';
import {NativeBackend} from '@senars/tensor/src/backends/NativeBackend.js';

describe('LossFunctor', function () {
    let loss, backend;

    beforeEach(function () {
        backend = new NativeBackend();
        loss = new LossFunctor(backend);
    });

    describe('MSE (Mean Squared Error)', function () {
        test('calculates MSE correctly', function () {
            const pred = new Tensor([1, 2, 3], {backend});
            const target = new Tensor([1.5, 2.5, 2.5], {backend});
            expect(loss.mse(pred, target).data[0]).toBeCloseTo(0.25);
        });

        test('MSE is zero for perfect predictions', function () {
            const pred = new Tensor([1, 2, 3], {backend});
            const target = new Tensor([1, 2, 3], {backend});

            const result = loss.mse(pred, target);
            expect(result.data[0]).toBeCloseTo(0);
        });

        test('MSE with gradients', function () {
            const pred = new Tensor([2, 3], {requiresGrad: true, backend});
            const target = new Tensor([1, 2], {backend});
            const result = loss.mse(pred, target);
            result.backward();

            expect(pred.grad?.data[0]).toBeCloseTo(1);
            expect(pred.grad?.data[1]).toBeCloseTo(1);
        });
    });

    describe('MAE (Mean Absolute Error)', function () {
        test('calculates MAE correctly', function () {
            const pred = new Tensor([1, 2, 3], {backend});
            const target = new Tensor([1.5, 2.5, 2.5], {backend});
            expect(loss.mae(pred, target).data[0]).toBeCloseTo(0.5);
        });

        test('MAE is zero for perfect predictions', function () {
            const pred = new Tensor([1, 2, 3], {backend});
            const target = new Tensor([1, 2, 3], {backend});

            const result = loss.mae(pred, target);
            expect(result.data[0]).toBeCloseTo(0);
        });
    });

    describe('Binary Cross-Entropy', function () {
        test('calculates BCE correctly', function () {
            const pred = new Tensor([0.7, 0.3], {backend});
            const target = new Tensor([1, 0], {backend});
            expect(loss.binaryCrossEntropy(pred, target).data[0]).toBeCloseTo(0.357, 2);
        });

        test('BCE clips predictions for stability', function () {
            const pred = new Tensor([0, 1], {backend}); // Extreme values
            const target = new Tensor([0, 1], {backend});

            const result = loss.binaryCrossEntropy(pred, target);
            expect(result.data[0]).toBeDefined();
            expect(isFinite(result.data[0])).toBe(true);
        });

        test('BCE with gradients', function () {
            const pred = new Tensor([0.7, 0.3], {requiresGrad: true, backend});
            const target = new Tensor([1, 0], {backend});

            const result = loss.binaryCrossEntropy(pred, target);
            result.backward();

            expect(pred.grad).toBeDefined();
            expect(pred.grad.data.length).toBe(2);
        });
    });

    describe('Cross-Entropy (Categorical)', function () {
        test('calculates cross-entropy correctly', function () {
            const pred = new Tensor([0.7, 0.2, 0.1], {backend});
            const target = new Tensor([1, 0, 0], {backend});
            expect(loss.crossEntropy(pred, target).data[0]).toBeCloseTo(0.357, 2);
        });

        test('cross-entropy clips predictions', function () {
            const pred = new Tensor([1, 0, 0], {backend});
            const target = new Tensor([1, 0, 0], {backend});
            expect(isFinite(loss.crossEntropy(pred, target).data[0])).toBe(true);
        });

        test('cross-entropy with gradients', function () {
            const pred = new Tensor([0.7, 0.2, 0.1], {requiresGrad: true, backend});
            const target = new Tensor([1, 0, 0], {backend});

            const result = loss.crossEntropy(pred, target);
            result.backward();

            expect(pred.grad).toBeDefined();
            expect(pred.grad.data.length).toBe(3);
        });
    });

    describe('Loss comparison', function () {
        test('MSE penalizes large errors more than MAE', function () {
            const pred = new Tensor([1, 5], {backend});
            const target = new Tensor([1, 1], {backend});
            const maeResult = loss.mae(pred, target);
            const mseResult = loss.mse(pred, target);
            expect(mseResult.data[0]).toBeGreaterThan(maeResult.data[0]);
        });
    });

    describe('Common Loss Behaviors', function () {
        const lossFunctions = [
            {name: 'MSE', fn: 'mse'},
            {name: 'MAE', fn: 'mae'}
        ];

        test.each(lossFunctions)('$name returns zero for perfect predictions', function ({fn}) {
            const pred = new Tensor([1, 2, 3], {backend});
            const target = new Tensor([1, 2, 3], {backend});
            const result = loss[fn](pred, target);
            expect(result.data[0]).toBeCloseTo(0);
        });

        const gradientLossFunctions = [
            {name: 'MSE', fn: 'mse'},
            {name: 'BCE', fn: 'binaryCrossEntropy'},
            {name: 'CrossEntropy', fn: 'crossEntropy'}
        ];

        test.each(gradientLossFunctions)('$name computes gradients', function ({fn}) {
            const pred = fn === 'crossEntropy'
                ? new Tensor([0.7, 0.2, 0.1], {requiresGrad: true, backend})
                : new Tensor([0.7, 0.3], {requiresGrad: true, backend});
            const target = fn === 'crossEntropy'
                ? new Tensor([1, 0, 0], {backend})
                : new Tensor([1, 0], {backend});

            const result = loss[fn](pred, target);
            result.backward();

            expect(pred.grad).toBeDefined();
            expect(pred.grad.data.length).toBeGreaterThan(0);
        });
    });
});

