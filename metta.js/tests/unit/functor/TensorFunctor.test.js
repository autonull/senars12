import {beforeEach, describe, expect, test} from '@jest/globals';
import {TensorFunctor} from '@senars/tensor/src/TensorFunctor.js';
import {Tensor} from '@senars/tensor/src/Tensor.js';
import {NativeBackend} from '@senars/tensor/src/backends/NativeBackend.js';

describe('TensorFunctor', () => {
    let functor;
    let backend;

    beforeEach(() => {
        backend = new NativeBackend();
        functor = new TensorFunctor(backend);
    });

    test('evaluates tensor creation', () => {
        const term = {
            operator: 'tensor',
            components: [[1, 2, 3]]
        };
        const result = functor.evaluate(term, new Map());
        expect(result).toBeInstanceOf(Tensor);
        expect(result.data).toEqual([1, 2, 3]);
    });

    test('evaluates binary operations', () => {
        const term = {
            operator: 'add',
            components: [
                {operator: 'tensor', components: [[1, 2]]},
                {operator: 'tensor', components: [[3, 4]]}
            ]
        };
        const result = functor.evaluate(term, new Map());
        expect(result.data).toEqual([4, 6]);
    });

    test('resolves variables from bindings', () => {
        const bindings = new Map();
        bindings.set('x', new Tensor([10], {backend}));

        const term = {
            operator: 'mul',
            components: [
                {isVariable: true, name: 'x'},
                {operator: 'tensor', components: [[2]]}
            ]
        };

        const result = functor.evaluate(term, bindings);
        expect(result.data).toEqual([20]);
    });

    test('evaluates nested expressions', () => {
        // (1 + 2) * 3
        const term = {
            operator: 'mul',
            components: [
                {
                    operator: 'add',
                    components: [
                        {operator: 'tensor', components: [[1]]},
                        {operator: 'tensor', components: [[2]]}
                    ]
                },
                {operator: 'tensor', components: [[3]]}
            ]
        };
        const result = functor.evaluate(term, new Map());
        expect(result.data).toEqual([9]);
    });

    test('handles shape operations', () => {
        const term = {
            operator: 'reshape',
            components: [
                {operator: 'tensor', components: [[1, 2, 3, 4]]},
                [2, 2]
            ]
        };
        const result = functor.evaluate(term, new Map());
        expect(result.shape).toEqual([2, 2]);
    });

    test('handles gradient operations', () => {
        const x = new Tensor([2], {requiresGrad: true, backend});
        const bindings = new Map([['x', x]]);

        // y = x * x
        const term = {
            operator: 'grad',
            components: [
                {
                    operator: 'mul',
                    components: [
                        {isVariable: true, name: 'x'},
                        {isVariable: true, name: 'x'}
                    ]
                },
                {isVariable: true, name: 'x'}
            ]
        };

        const grad = functor.evaluate(term, bindings);
        // dy/dx = 2x = 4
        expect(grad.data).toEqual([4]);
    });

    test('handles truth conversion', () => {
        const term = {
            operator: 'truth_to_tensor',
            components: [
                {f: 1.0, c: 0.9},
                'scalar'
            ]
        };
        const result = functor.evaluate(term, new Map());
        expect(result).toBeInstanceOf(Tensor);
        expect(result.data[0]).toBeCloseTo(1.0); // frequency
    });

    test('handles optimizer steps', () => {
        const param = new Tensor([1.0], {requiresGrad: true, backend});
        param.grad = new Tensor([0.1], {backend});
        const bindings = new Map([['w', param]]);

        const term = {
            operator: 'sgd_step',
            components: [
                {isVariable: true, name: 'w'},
                0.1 // lr
            ]
        };

        functor.evaluate(term, bindings);
        // w = w - lr * grad = 1.0 - 0.1 * 0.1 = 0.99
        expect(param.data[0]).toBeCloseTo(0.99);
    });
});
