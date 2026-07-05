import {describe, expect, test} from '@jest/globals';
import {NativeBackend, T} from '@senars/tensor/src/backends/NativeBackend.js';
import {Embedding, Linear, Module, MultiHeadAttention, Sequential} from '@senars/tensor/src/Module.js';

describe('Module System', () => {
    describe('Module base class', () => {
        test('registers parameters', () => {
            const mod = new Module();
            const param = T.tensor([[1, 2]]);
            mod.parameter('weight', param);

            expect(mod._parameters.has('weight')).toBe(true);
            expect(param.requiresGrad).toBe(true);
        });

        test('registers submodules', () => {
            const parent = new Module();
            const child = new Module();
            parent.module('child', child);

            expect(parent._modules.has('child')).toBe(true);
        });

        test('collects parameters recursively', () => {
            const parent = new Module();
            const child = new Module();

            parent.parameter('p1', T.tensor([1]));
            child.parameter('p2', T.tensor([2]));
            parent.module('child', child);

            const params = parent.parameters();
            expect(params.length).toBe(2);
        });

        test('train/eval modes cascade', () => {
            const parent = new Module();
            const child = new Module();
            parent.module('child', child);

            parent.eval();
            expect(parent.training).toBe(false);
            expect(child.training).toBe(false);

            parent.train();
            expect(parent.training).toBe(true);
            expect(child.training).toBe(true);
        });

        test('stateDict serializes parameters', () => {
            const mod = new Module();
            mod.parameter('weight', T.tensor([[1, 2], [3, 4]]));

            const state = mod.stateDict();
            expect(state).toHaveProperty('weight');
            expect(state.weight).toEqual([1, 2, 3, 4]);
        });

        test('stateDict includes nested modules', () => {
            const parent = new Module();
            const child = new Module();

            parent.parameter('p1', T.tensor([1]));
            child.parameter('p2', T.tensor([2]));
            parent.module('child', child);

            const state = parent.stateDict();
            expect(state['p1']).toBeDefined();
            expect(state['child.p2']).toBeDefined();
        });

        test('loadStateDict restores parameters', () => {
            const mod = new Module();
            const weight = T.tensor([[1, 2]]);
            mod.parameter('weight', weight);

            const originalState = mod.stateDict();
            weight.data.fill(999);

            mod.loadStateDict(originalState);
            expect(weight.data).toEqual(originalState.weight);
        });
    });

    describe('Linear layer', () => {
        test('forward pass', () => {
            const layer = new Linear(2, 3);
            const input = T.tensor([[1, 2]]);
            const output = layer.forward(input);

            expect(output.shape).toEqual([1, 3]);
        });

        test('has correct parameters', () => {
            const layer = new Linear(2, 3);
            const params = layer.parameters();

            expect(params.length).toBe(2); // weight + bias
            expect(params[0].shape).toEqual([2, 3]);
            expect(params[1].shape).toEqual([3]);
        });

        test('can disable bias', () => {
            const layer = new Linear(2, 3, {bias: false});
            const params = layer.parameters();

            expect(params.length).toBe(1); // weight only
            expect(layer.bias).toBeNull();
        });

        test('gradient flows through layer', () => {
            const layer = new Linear(2, 1);
            const input = T.tensor([[1, 2]]);
            const output = layer.forward(input);

            output.backward();

            expect(layer.weight.grad).not.toBeNull();
            expect(layer.bias.grad).not.toBeNull();
        });

        test('can pass explicit backend', () => {
            const customBackend = new NativeBackend();
            const layer = new Linear(2, 3, {backend: customBackend});
            expect(layer.backend).toBe(customBackend);
        });
    });

    describe('Embedding layer', () => {
        test('forward pass', () => {
            const layer = new Embedding(10, 5);
            const indices = T.tensor([0, 2, 4]);
            const output = layer.forward(indices);

            expect(output.shape).toEqual([3, 5]);
        });

        test('has correct weight shape', () => {
            const layer = new Embedding(100, 50);
            expect(layer.weight.shape).toEqual([100, 50]);
        });

        test('gradient updates embeddings', () => {
            const layer = new Embedding(5, 3);
            const indices = T.tensor([0, 2]);
            const output = layer.forward(indices);
            const loss = T.sum(output);

            loss.backward();
            expect(layer.weight.grad).not.toBeNull();
        });
    });

    describe('Sequential container', () => {
        test('chains layers', () => {
            const net = new Sequential(
                new Linear(2, 4),
                new Linear(4, 1)
            );

            const input = T.tensor([[1, 2]]);
            const output = net.forward(input);

            expect(output.shape).toEqual([1, 1]);
        });

        test('collects all parameters', () => {
            const net = new Sequential(
                new Linear(2, 4),
                new Linear(4, 1)
            );

            const params = net.parameters();
            expect(params.length).toBe(4); // 2 weights + 2 biases
        });

        test('backward pass through network', () => {
            const net = new Sequential(
                new Linear(2, 4),
                new Linear(4, 1)
            );

            const input = T.tensor([[1, 2]]);
            const output = net.forward(input);

            output.backward();

            const params = net.parameters();
            expect(params.every(p => p.grad !== null)).toBe(true);
        });
    });

    describe('MultiHeadAttention', () => {
        test('creates with correct dimensions', () => {
            const mha = new MultiHeadAttention(8, 2);
            expect(mha.dModel).toBe(8);
            expect(mha.numHeads).toBe(2);
            expect(mha.headDim).toBe(4);
        });

        test('throws if dModel not divisible by numHeads', () => {
            expect(() => new MultiHeadAttention(7, 2)).toThrow(/divisible/);
        });

        test('forward pass', () => {
            const mha = new MultiHeadAttention(4, 2);
            const input = T.tensor([[1, 2, 3, 4]]);
            const output = mha.forward(input);

            expect(output.shape).toEqual([1, 4]);
        });
    });
});
