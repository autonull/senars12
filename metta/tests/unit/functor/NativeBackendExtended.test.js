import {beforeEach, describe, expect, test} from '@jest/globals';
import {Tensor} from '@senars/tensor/src/Tensor.js';
import {NativeBackend} from '@senars/tensor/src/backends/NativeBackend.js';

describe('NativeBackend Extended Ops', () => {
    let backend;

    beforeEach(() => {
        backend = new NativeBackend();
    });

    describe('einsum', () => {
        test('matrix multiplication pattern ij,jk->ik', () => {
            const a = new Tensor([[1, 2], [3, 4]], {backend});
            const b = new Tensor([[5, 6], [7, 8]], {backend});
            const c = backend.einsum('ij,jk->ik', a, b);
            expect(c.shape).toEqual([2, 2]);
            expect(c.data).toEqual([19, 22, 43, 50]);
        });

        test('dot product pattern i,i->', () => {
            const a = new Tensor([1, 2, 3], {backend});
            const b = new Tensor([4, 5, 6], {backend});
            const c = backend.einsum('i,i->', a, b);
            expect(c.data[0]).toBe(32); // 1*4 + 2*5 + 3*6
        });

        test('outer product pattern i,j->ij', () => {
            const a = new Tensor([1, 2], {backend});
            const b = new Tensor([3, 4], {backend});
            const c = backend.einsum('i,j->ij', a, b);
            expect(c.shape).toEqual([2, 2]);
            expect(c.data).toEqual([3, 4, 6, 8]);
        });

        test('transpose pattern ij->ji', () => {
            const a = new Tensor([[1, 2, 3], [4, 5, 6]], {backend});
            const c = backend.einsum('ij->ji', a);
            expect(c.shape).toEqual([3, 2]);
            expect(c.data).toEqual([1, 4, 2, 5, 3, 6]);
        });

        test('trace pattern ii->', () => {
            const a = new Tensor([[1, 2], [3, 4]], {backend});
            const c = backend.einsum('ii->', a);
            expect(c.data[0]).toBe(5); // 1 + 4
        });

        test('sum over axis patterns', () => {
            const a = new Tensor([[1, 2], [3, 4]], {backend});
            const rowSum = backend.einsum('ij->i', a);
            const colSum = backend.einsum('ij->j', a);
            expect(rowSum.data).toEqual([3, 7]);
            expect(colSum.data).toEqual([4, 6]);
        });

        test('throws on unsupported pattern', () => {
            const a = new Tensor([[1, 2]], {backend});
            expect(() => backend.einsum('xyz->abc', a)).toThrow(/not supported/);
        });
    });

    describe('tensor contractions', () => {
        test('outer product with gradient', () => {
            const a = new Tensor([2, 3], {requiresGrad: true, backend});
            const b = new Tensor([4, 5], {requiresGrad: true, backend});
            const c = backend.outer(a, b);

            expect(c.shape).toEqual([2, 2]);
            expect(c.data).toEqual([8, 10, 12, 15]);

            c.backward();
            // ∂L/∂a[i] = Σ_j (grad[i,j] * b[j]) = 1*4 + 1*5 = 9 for each i
            // ∂L/∂b[j] = Σ_i (grad[i,j] * a[i]) = 1*2 + 1*3 = 5 for each j
            expect(a.grad.data).toEqual([9, 9]);
            expect(b.grad.data).toEqual([5, 5]);
        });

        test('trace with gradient', () => {
            const a = new Tensor([[2, 3], [4, 5]], {requiresGrad: true, backend});
            const c = backend.trace(a);

            expect(c.data[0]).toBe(7); // 2 + 5

            c.backward();
            expect(a.grad.data).toEqual([1, 0, 0, 1]); // diagonal ones
        });
    });

    describe('composed ops', () => {
        test('attention mechanism', () => {
            const q = new Tensor([[1, 2]], {backend});
            const k = new Tensor([[1, 2], [3, 4]], {backend});
            const v = new Tensor([[5, 6], [7, 8]], {backend});
            const out = backend.attention(q, k, v);
            expect(out.shape).toEqual([1, 2]);
            expect(out.data.every(x => !isNaN(x))).toBe(true);
        });

        test('layerNorm normalizes distribution', () => {
            const x = new Tensor([[1, 2, 3, 4, 5]], {backend});
            const normalized = backend.layerNorm(x);

            const mean = normalized.data.reduce((a, b) => a + b, 0) / normalized.size;
            const variance = normalized.data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / normalized.size;

            expect(mean).toBeCloseTo(0, 5);
            expect(Math.sqrt(variance)).toBeCloseTo(1, 1);
        });

        test('cosineSimilarity computes correctly', () => {
            const a = new Tensor([1, 0, 0], {backend});
            const b = new Tensor([1, 0, 0], {backend});
            const sim = backend.cosineSimilarity(a, b);
            expect(sim.data[0]).toBeCloseTo(1, 5);

            const c = new Tensor([0, 1, 0], {backend});
            const sim2 = backend.cosineSimilarity(a, c);
            expect(sim2.data[0]).toBeCloseTo(0, 5);
        });

        test('dropout in training mode', () => {
            const x = new Tensor([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], {backend});
            const dropped = backend.dropout(x, 0.5, true);

            const nonZero = dropped.data.filter(v => v !== 0).length;
            expect(nonZero).toBeGreaterThan(0);
            expect(nonZero).toBeLessThan(10);
        });

        test('dropout in eval mode returns input', () => {
            const x = new Tensor([1, 2, 3], {backend});
            const dropped = backend.dropout(x, 0.5, false);
            expect(dropped.data).toEqual(x.data);
        });

        test('clamp limits values', () => {
            const x = new Tensor([-5, 0, 5, 10], {backend});
            const clamped = backend.clamp(x, 0, 5);
            expect(clamped.data).toEqual([0, 0, 5, 5]);
        });
    });

    describe('array ops', () => {
        test('concat along axis 0', () => {
            const a = new Tensor([[1, 2]], {backend});
            const b = new Tensor([[3, 4]], {backend});
            const c = backend.concat([a, b], 0);
            expect(c.shape).toEqual([2, 2]);
            expect(c.data).toEqual([1, 2, 3, 4]);
        });

        test('concat along axis 1', () => {
            const a = new Tensor([[1], [2]], {backend});
            const b = new Tensor([[3], [4]], {backend});
            const c = backend.concat([a, b], 1);
            expect(c.shape).toEqual([2, 2]);
            expect(c.data).toEqual([1, 3, 2, 4]);
        });

        test('concat gradient flows back', () => {
            const a = new Tensor([[1, 2]], {requiresGrad: true, backend});
            const b = new Tensor([[3, 4]], {requiresGrad: true, backend});
            const c = backend.concat([a, b], 0);
            const loss = backend.sum(c);

            loss.backward();
            expect(a.grad.data).toEqual([1, 1]);
            expect(b.grad.data).toEqual([1, 1]);
        });

        test('slice extracts subset', () => {
            const a = new Tensor([[1, 2], [3, 4], [5, 6]], {backend});
            const b = backend.slice(a, 0, 2, 0);
            expect(b.shape).toEqual([2, 2]);
            expect(b.data).toEqual([1, 2, 3, 4]);
        });

        test('slice gradient', () => {
            const a = new Tensor([[1, 2], [3, 4], [5, 6]], {requiresGrad: true, backend});
            const b = backend.slice(a, 1, 3, 0);
            const loss = backend.sum(b);

            loss.backward();
            expect(a.grad.data).toEqual([0, 0, 1, 1, 1, 1]);
        });

        test('stack tensors', () => {
            const a = new Tensor([1, 2], {backend});
            const b = new Tensor([3, 4], {backend});
            const c = backend.stack([a, b], 0);
            expect(c.shape).toEqual([2, 2]);
            expect(c.data).toEqual([1, 2, 3, 4]);
        });

        test('unsqueeze adds dimension', () => {
            const a = new Tensor([1, 2, 3], {backend});
            const b = backend.unsqueeze(a, 0);
            expect(b.shape).toEqual([1, 3]);

            const c = backend.unsqueeze(a, 1);
            expect(c.shape).toEqual([3, 1]);
        });

        test('gather selects rows', () => {
            const a = new Tensor([[1, 2], [3, 4], [5, 6]], {backend});
            const indices = new Tensor([0, 2], {backend});
            const b = backend.gather(a, indices, 0);
            expect(b.shape).toEqual([2, 2]);
            expect(b.data).toEqual([1, 2, 5, 6]);
        });

        test('gather gradient accumulates', () => {
            const a = new Tensor([[1, 2], [3, 4], [5, 6]], {requiresGrad: true, backend});
            const indices = new Tensor([0, 0], {backend});
            const b = backend.gather(a, indices, 0);
            const loss = backend.sum(b);

            loss.backward();
            expect(a.grad.data).toEqual([2, 2, 0, 0, 0, 0]); // first row selected twice
        });
    });

    describe('initialization', () => {
        test('randn produces normal distribution', () => {
            const t = backend.randn([10000]);
            const mean = t.data.reduce((a, b) => a + b) / t.size;
            const variance = t.data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / t.size;

            expect(mean).toBeCloseTo(0, 1);
            expect(Math.sqrt(variance)).toBeCloseTo(1, 1);
        });

        test('randn with custom mean and std', () => {
            const t = backend.randn([1000], 5, 2);
            const mean = t.data.reduce((a, b) => a + b) / t.size;

            expect(mean).toBeCloseTo(5, 0.5);
        });

        test('xavierUniform within bounds', () => {
            const t = backend.xavierUniform([10, 10]);
            const bound = Math.sqrt(6.0 / 20);

            expect(Math.max(...t.data)).toBeLessThanOrEqual(bound + 1e-10);
            expect(Math.min(...t.data)).toBeGreaterThanOrEqual(-bound - 1e-10);
        });

        test('kaimingNormal for relu', () => {
            const t = backend.kaimingNormal([100, 50], 0, 'fan_in', 'relu');
            const variance = t.data.reduce((a, b) => a + b * b, 0) / t.size;
            const expected = 2.0 / 100; // var = 2 / fan_in for relu

            expect(variance).toBeCloseTo(expected, 1);
        });
    });
});
