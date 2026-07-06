import {Tensor} from '@senars/tensor/src/Tensor.js';

describe('Tensor', () => {
    describe('construction', () => {
        test('1D', () => {
            const t = new Tensor([1, 2, 3]);
            expect(t.shape).toEqual([3]);
            expect(t.ndim).toBe(1);
            expect(t.size).toBe(3);
            expect(t.data).toEqual([1, 2, 3]);
        });

        test('2D', () => {
            const t = new Tensor([[1, 2], [3, 4]]);
            expect(t.shape).toEqual([2, 2]);
            expect(t.ndim).toBe(2);
            expect(t.size).toBe(4);
            expect(t.data).toEqual([1, 2, 3, 4]);
        });

        test('3D', () => {
            const t = new Tensor([[[1, 2], [3, 4]], [[5, 6], [7, 8]]]);
            expect(t.shape).toEqual([2, 2, 2]);
            expect(t.ndim).toBe(3);
            expect(t.size).toBe(8);
        });
    });

    describe('ops', () => {
        test('reshape', () => {
            const t = new Tensor([1, 2, 3, 4]);
            const reshaped = t.reshape([2, 2]);
            expect(reshaped.shape).toEqual([2, 2]);
            expect(reshaped.toArray()).toEqual([[1, 2], [3, 4]]);
            expect(() => t.reshape([2, 2, 2])).toThrow();
        });

        test('transpose', () => {
            const t = new Tensor([[1, 2, 3], [4, 5, 6]]);
            const transposed = t.transpose();
            expect(transposed.shape).toEqual([3, 2]);
            expect(transposed.toArray()).toEqual([[1, 4], [2, 5], [3, 6]]);
        });
    });

    test('serialization', () => {
        const t = new Tensor([[1, 2], [3, 4]]);
        const restored = Tensor.fromJSON(t.toJSON());
        expect(restored.shape).toEqual(t.shape);
        expect(restored.data).toEqual(t.data);
    });
});
