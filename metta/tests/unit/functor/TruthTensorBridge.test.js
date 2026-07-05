import {beforeEach, describe, expect, test} from '@jest/globals';
import {TruthTensorBridge} from '@senars/tensor/src/TruthTensorBridge.js';
import {Tensor} from '@senars/tensor/src/Tensor.js';
import {NativeBackend} from '@senars/tensor/src/backends/NativeBackend.js';

describe('TruthTensorBridge', function () {
    let bridge, backend;

    beforeEach(function () {
        backend = new NativeBackend();
        bridge = new TruthTensorBridge(backend);
    });

    describe('truthToTensor', function () {
        test('scalar mode - extracts frequency', function () {
            const truth = {f: 0.8, c: 0.9};
            const tensor = bridge.truthToTensor(truth, 'scalar');

            expect(tensor).toBeInstanceOf(Tensor);
            expect(tensor.shape).toEqual([1]);
            expect(tensor.data[0]).toBe(0.8);
        });

        test('bounds mode - calculates upper and lower bounds', function () {
            const truth = {f: 0.8, c: 0.9};
            // lower = f * c = 0.72
            // upper = f * c + (1 - c) = 0.72 + 0.1 = 0.82
            const tensor = bridge.truthToTensor(truth, 'bounds');

            expect(tensor.shape).toEqual([2]);
            expect(tensor.data[0]).toBeCloseTo(0.72);
            expect(tensor.data[1]).toBeCloseTo(0.82);
        });

        test('vector mode - includes frequency, confidence, and expectation', function () {
            const truth = {f: 0.8, c: 0.9};
            // e = c * (f - 0.5) + 0.5 = 0.9 * 0.3 + 0.5 = 0.77
            const tensor = bridge.truthToTensor(truth, 'vector');

            expect(tensor.shape).toEqual([3]);
            expect(tensor.data[0]).toBe(0.8);  // frequency
            expect(tensor.data[1]).toBe(0.9);  // confidence
            expect(tensor.data[2]).toBeCloseTo(0.77); // expectation
        });

        test('accepts array format [f, c]', function () {
            const tensor = bridge.truthToTensor([0.7, 0.8], 'scalar');
            expect(tensor.data[0]).toBe(0.7);
        });

        test('throws on unknown mode', function () {
            expect(() => bridge.truthToTensor({f: 0.5, c: 0.9}, 'unknown'))
                .toThrow('Unknown truthToTensor mode');
        });
    });

    describe('tensorToTruth', function () {
        test('sigmoid mode - uses default confidence', function () {
            const tensor = new Tensor([0.7], {backend});
            const truth = bridge.tensorToTruth(tensor, 'sigmoid');

            expect(truth.f).toBe(0.7);
            expect(truth.c).toBe(0.9);
        });

        test('dual mode - extracts both f and c', function () {
            const tensor = new Tensor([0.7, 0.8], {backend});
            const truth = bridge.tensorToTruth(tensor, 'dual');

            expect(truth.f).toBe(0.7);
            expect(truth.c).toBe(0.8);
        });

        test('softmax mode - uses max probability', function () {
            const tensor = new Tensor([0.1, 0.7, 0.2], {backend});
            const truth = bridge.tensorToTruth(tensor, 'softmax');

            expect(truth.f).toBe(0.7);  // max
            expect(truth.c).toBeCloseTo(0.75); // 1 - 1/(3+1)
        });

        test('throws on unknown mode', function () {
            const tensor = new Tensor([0.5], {backend});
            expect(() => bridge.tensorToTruth(tensor, 'unknown'))
                .toThrow('Unknown tensorToTruth mode');
        });
    });

    describe('round-trip conversion', function () {
        test('scalar mode preserves frequency', function () {
            const original = {f: 0.75, c: 0.85};
            const tensor = bridge.truthToTensor(original, 'scalar');
            const recovered = bridge.tensorToTruth(tensor, 'sigmoid');

            expect(recovered.f).toBeCloseTo(original.f);
        });

        test('dual mode preserves both values', function () {
            const original = {f: 0.75, c: 0.85};
            const tensor = bridge.truthToTensor(original, 'bounds');
            const recovered = bridge.tensorToTruth(tensor, 'dual');

            // Lower bound = f * c
            expect(recovered.f).toBeCloseTo(0.6375);
            // Upper bound = f * c + (1 - c)
            expect(recovered.c).toBeCloseTo(0.7875);
        });
    });

    describe('truthToExpectation', function () {
        test('calculates NAL expectation', function () {
            const expectation = bridge.truthToExpectation({f: 0.8, c: 0.9});
            // e = c * (f - 0.5) + 0.5 = 0.9 * 0.3 + 0.5 = 0.77
            expect(expectation).toBeCloseTo(0.77);
        });

        test('handles array format', function () {
            const expectation = bridge.truthToExpectation([0.8, 0.9]);
            expect(expectation).toBeCloseTo(0.77);
        });
    });

    describe('truthsToTensor', function () {
        test('batch converts scalar mode', function () {
            const truths = [
                {f: 0.7, c: 0.8},
                {f: 0.6, c: 0.9},
                {f: 0.8, c: 0.7}
            ];
            const tensor = bridge.truthsToTensor(truths, 'scalar');

            expect(tensor.shape).toEqual([3]);
            expect(tensor.data).toEqual([0.7, 0.6, 0.8]);
        });

        test('batch converts vector mode', function () {
            const truths = [
                {f: 0.7, c: 0.8},
                {f: 0.6, c: 0.9}
            ];
            const tensor = bridge.truthsToTensor(truths, 'vector');

            expect(tensor.shape).toEqual([2, 3]);
            expect(tensor.data.length).toBe(6);
        });
    });
});
