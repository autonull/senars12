import {TensorBackend} from './TensorBackend.js';
import {Tensor} from '../Tensor.js';

export class NativeBackend extends TensorBackend {
    _unaryWithGrad(a, forwardFn, gradMaskFn) {
        if (!(a instanceof Tensor)) {
            a = new Tensor([a], {backend: this});
        }
        const result = this._createTensor(a.data.map(forwardFn), [...a.shape]);
        if (a.requiresGrad) {
            result.requiresGrad = true;
            result._parents = [a];
            result._gradFn = () => this._accumulateGrad(a, this.mul(result.grad, gradMaskFn(a, result)));
        }
        return result;
    }

    matmul(a, b) {
        if (!(a instanceof Tensor) || !(b instanceof Tensor)) {
            throw new Error('matmul requires Tensor');
        }

        let result;
        const [m, k1] = a.shape.length === 1 ? [1, a.shape[0]] : a.shape;
        const [k2, n] = b.shape.length === 1 ? [b.shape[0], 1] : b.shape;

        if (k1 !== k2) {
            throw new Error(`Incompatible shapes: ${a.shape} vs ${b.shape}`);
        }

        if (a.ndim === 1 && b.ndim === 1) {
            result = new Tensor([a.data.reduce((s, v, i) => s + v * b.data[i], 0)], {backend: this});
        } else {
            const data = new Array(m * n).fill(0);
            for (let i = 0; i < m; i++) {
                for (let k = 0; k < k1; k++) {
                    for (let j = 0; j < n; j++) {
                        data[i * n + j] += a.data[i * k1 + k] * b.data[k * n + j];
                    }
                }
            }

            result = this._createTensor(data, a.ndim === 1 ? [n] : (b.ndim === 1 ? [m] : [m, n]));
        }

        if (a.requiresGrad || b.requiresGrad) {
            this._withGrad(result, [a, b], () => {
                if (a.requiresGrad) {
                    this._accumulateGrad(a, this.matmul(result.grad, this.transpose(b)));
                }
                if (b.requiresGrad) {
                    this._accumulateGrad(b, this.matmul(this.transpose(a), result.grad));
                }
            });
        }
        return result;
    }

    add(a, b) {
        return this._elementwise(a, b, (x, y) => x + y, (g) => [g, g]);
    }

    sub(a, b) {
        return this._elementwise(a, b, (x, y) => x - y, (g, a, b, bk) => [g, bk.neg(g)]);
    }

    mul(a, b) {
        return this._elementwise(a, b, (x, y) => x * y, (g, a, b, bk) => [bk.mul(g, b), bk.mul(g, a)]);
    }

    div(a, b) {
        return this._elementwise(a, b, (x, y) => x / y, (g, a, b, bk) => [bk.div(g, b), bk.neg(bk.div(bk.mul(g, a), bk.mul(b, b)))]);
    }

    _elementwise(a, b, op, gradOp) {
        if (typeof a === 'number') {
            a = new Tensor([a], {backend: this});
        }
        if (typeof b === 'number') {
            b = new Tensor([b], {backend: this});
        }

        // Broadcasting logic
        let data;
        const [sa, sb] = [a.shape, b.shape];
        const [na, nb] = [a.size, b.size];

        if (na === nb && sa.join() === sb.join()) {
            data = a.data.map((v, i) => op(v, b.data[i]));
        } else if (nb === 1) {
            data = a.data.map(v => op(v, b.data[0]));
        } else if (na === 1) {
            data = b.data.map(v => op(a.data[0], v));
        } else if (a.ndim === 2 && b.ndim === 2 && sb[0] === 1 && sa[1] === sb[1]) { // [m,n] + [1,n]
            data = a.data.map((v, i) => op(v, b.data[i % sa[1]]));
        } else if (a.ndim === 2 && b.ndim === 2 && sa[0] === 1 && sa[1] === sb[1]) { // [1,n] + [m,n]
            data = b.data.map((v, i) => op(a.data[i % sb[1]], v));
        } else if (a.ndim === 2 && b.ndim === 1 && sa[1] === sb[0]) { // [m,n] + [n]
            data = a.data.map((v, i) => op(v, b.data[i % sa[1]]));
        } else if (a.ndim === 1 && b.ndim === 2 && sa[0] === sb[1]) { // [n] + [m,n]
            data = b.data.map((v, i) => op(a.data[i % sb[1]], v));
        } else if (a.ndim === 1 && b.ndim === 2 && sa[0] === sb[0]) { // [n] + [n, m] (specifically [n] + [n, 1])
            // if m=1, stride is 1. i/1 = i.
            const m = sb[1];
            data = b.data.map((v, i) => op(a.data[Math.floor(i / m)], v));
        } else if (a.ndim === 2 && b.ndim === 1 && sa[0] === sb[0]) { // [n, m] + [n]
            const m = sa[1];
            data = a.data.map((v, i) => op(v, b.data[Math.floor(i / m)]));
        } else if (a.ndim === 2 && b.ndim === 2 && sb[1] === 1 && sa[0] === sb[0]) { // [m,n] + [m,1]
            // stride for A is n (for row) + 1 (for col)
            // stride for B is 1 (for row) + 0 (for col - effectively)
            // i goes 0..m*n-1. row = floor(i/n). col = i%n.
            // B index = row * 1 + 0 = floor(i/n)
            const n = sa[1];
            data = a.data.map((v, i) => op(v, b.data[Math.floor(i / n)]));
        } else if (a.ndim === 2 && b.ndim === 2 && sa[1] === 1 && sa[0] === sb[0]) { // [m,1] + [m,n]
            const n = sb[1];
            data = b.data.map((v, i) => op(a.data[Math.floor(i / n)], v));
        } else {
            throw new Error(`Broadcasting not supported: ${sa} vs ${sb}`);
        }

        const result = this._createTensor(data, na >= nb ? [...a.shape] : [...b.shape]);

        if (a.requiresGrad || b.requiresGrad) {
            result.requiresGrad = true;
            result._parents = [a, b];
            result._gradFn = () => {
                if (gradOp) {
                    const [gA, gB] = gradOp(result.grad, a, b, this);
                    if (a.requiresGrad) {
                        this._accumulateGrad(a, gA);
                    }
                    if (b.requiresGrad) {
                        this._accumulateGrad(b, gB);
                    }
                }
            };
        }
        return result;
    }

    _accumulateGrad(t, g) {
        t.grad = t.grad ? this.add(t.grad, g) : g;
    }

    _createTensor(data, shape) {
        const t = new Tensor(0, {backend: this});
        t.data = data;
        t.shape = shape;
        return t;
    }

    _withGrad(result, parents, gradFn) {
        if (parents.some(p => p.requiresGrad)) {
            result.requiresGrad = true;
            result._parents = parents;
            result._gradFn = gradFn;
        }
        return result;
    }

    transpose(a) {
        const res = a.transpose();
        if (a.requiresGrad) {
            res.requiresGrad = true;
            res._parents = [a];
            res._gradFn = () => this._accumulateGrad(a, this.transpose(res.grad));
        }
        return res;
    }

    reshape(a, shape) {
        const res = a.reshape(shape);
        if (a.requiresGrad) {
            res.requiresGrad = true;
            res._parents = [a];
            res._gradFn = () => this._accumulateGrad(a, this.reshape(res.grad, a.shape));
        }
        return res;
    }

    neg(a) {
        return this._unaryWithGrad(a, x => -x, () => this._createTensor(Array(a.size).fill(-1), a.shape));
    }

    relu(a) {
        return this._unaryWithGrad(a, x => Math.max(0, x), i => this._createTensor(i.data.map(x => x > 0 ? 1 : 0), i.shape));
    }

    sigmoid(a) {
        return this._unaryWithGrad(a, x => 1 / (1 + Math.exp(-x)), (_, r) => {
            const oneMinus = this._createTensor(r.data.map(s => 1 - s), r.shape);
            return this.mul(r, oneMinus);
        });
    }

    tanh(a) {
        return this._unaryWithGrad(a, x => Math.tanh(x), (_, r) => this.sub(this.ones(r.shape), this.mul(r, r)));
    }

    softmax(a, axis = -1) {
        if (!(a instanceof Tensor)) {
            a = new Tensor([a], {backend: this});
        }
        if (axis < 0) {
            axis = a.ndim + axis;
        }
        if (a.ndim !== 1 && axis !== a.ndim - 1) {
            throw new Error('Softmax only implemented for 1D or last axis');
        }

        const max = Math.max(...a.data);
        const exp = a.data.map(x => Math.exp(x - max));
        const sum = exp.reduce((a, b) => a + b, 0);
        const t = this._createTensor(exp.map(x => x / sum), [...a.shape]);
        if (a.requiresGrad) {
            t.requiresGrad = true;
            t._parents = [a];
            t._gradFn = () => {
                const s = t.data;
                const g = t.grad.data;
                const dot = s.reduce((acc, v, i) => acc + v * g[i], 0);
                const grad = s.map((v, i) => (g[i] - dot) * v);
                this._accumulateGrad(a, this._createTensor(grad, a.shape));
            };
        }
        return t;
    }

    gelu(a) {
        const C = 0.044715, S = Math.sqrt(2 / Math.PI);
        return this._unaryWithGrad(a,
            x => 0.5 * x * (1 + Math.tanh(S * (x + C * x ** 3))),
            i => this._createTensor(i.data.map(x => {
                const u = S * (x + C * x ** 3);
                const t = Math.tanh(u);
                return 0.5 * (1 + t) + 0.5 * x * (1 - t * t) * S * (1 + 3 * C * x * x);
            }), i.shape)
        );
    }

    exp(a) {
        return this._unaryWithGrad(a, Math.exp, (_, r) => r);
    }

    log(a) {
        return this._unaryWithGrad(a, Math.log, i => this._createTensor(i.data.map(x => 1 / x), i.shape));
    }

    sqrt(a) {
        return this._unaryWithGrad(a, Math.sqrt, (_, r) => this._createTensor(r.data.map(s => 0.5 / s), r.shape));
    }

    pow(a, n) {
        if (!(a instanceof Tensor)) {
            a = new Tensor([a], {backend: this});
        }
        const res = this._createTensor(a.data.map(x => Math.pow(x, n)), [...a.shape]);
        if (a.requiresGrad) {
            res.requiresGrad = true;
            res._parents = [a];
            res._gradFn = () => this._accumulateGrad(a, this.mul(res.grad, this._createTensor(a.data.map(x => n * Math.pow(x, n - 1)), a.shape)));
        }
        return res;
    }

    abs(a) {
        return this._unaryWithGrad(a, Math.abs, i => this._createTensor(i.data.map(x => x >= 0 ? 1 : -1), i.shape));
    }

    _reduceAxis(a, axis, reduceFn, gradFn) {
        if (!(a instanceof Tensor)) {
            a = new Tensor([a], {backend: this});
        }
        if (axis < 0) {
            axis = a.ndim + axis;
        }

        const newShape = a.shape.filter((_, i) => i !== axis);
        if (newShape.length === 0) {
            newShape.push(1);
        }

        const axisSize = a.shape[axis];
        const outerSize = a.shape.slice(0, axis).reduce((p, c) => p * c, 1);
        const innerSize = a.shape.slice(axis + 1).reduce((p, c) => p * c, 1);
        const resultData = new Array(outerSize * innerSize);

        for (let o = 0; o < outerSize; o++) {
            for (let i = 0; i < innerSize; i++) {
                const vals = [];
                for (let x = 0; x < axisSize; x++) {
                    vals.push(a.data[o * axisSize * innerSize + x * innerSize + i]);
                }
                resultData[o * innerSize + i] = reduceFn(vals);
            }
        }

        const res = this._createTensor(resultData, newShape);
        if (a.requiresGrad && gradFn) {
            res.requiresGrad = true;
            res._parents = [a];
            res._gradFn = () => gradFn(a, res, axis, axisSize, outerSize, innerSize, this);
        }
        return res;
    }

    sum(a, axis = null) {
        if (axis === null) {
            const res = new Tensor([a.data.reduce((s, v) => s + v, 0)], {backend: this});
            if (a.requiresGrad) {
                res.requiresGrad = true;
                res._parents = [a];
                res._gradFn = () => this._accumulateGrad(a, this._createTensor(Array(a.size).fill(res.grad.data[0]), a.shape));
            }
            return res;
        }
        return this._reduceAxis(a, axis, v => v.reduce((s, x) => s + x, 0), (a, r, ax, as, os, is, bk) => {
            const g = new Array(a.size);
            for (let o = 0; o < os; o++) {
                for (let i = 0; i < is; i++) {
                    const gv = r.grad.data[o * is + i];
                    for (let x = 0; x < as; x++) {
                        g[o * as * is + x * is + i] = gv;
                    }
                }
            }
            bk._accumulateGrad(a, bk._createTensor(g, a.shape));
        });
    }

    mean(a, axis = null) {
        if (axis === null) {
            const res = new Tensor([a.data.reduce((s, v) => s + v, 0) / a.size], {backend: this});
            if (a.requiresGrad) {
                res.requiresGrad = true;
                res._parents = [a];
                res._gradFn = () => this._accumulateGrad(a, this._createTensor(Array(a.size).fill(res.grad.data[0] / a.size), a.shape));
            }
            return res;
        }
        return this._reduceAxis(a, axis, v => v.reduce((s, x) => s + x, 0) / v.length, (a, r, ax, as, os, is, bk) => {
            const g = new Array(a.size);
            for (let o = 0; o < os; o++) {
                for (let i = 0; i < is; i++) {
                    const gv = r.grad.data[o * is + i] / as;
                    for (let x = 0; x < as; x++) {
                        g[o * as * is + x * is + i] = gv;
                    }
                }
            }
            bk._accumulateGrad(a, bk._createTensor(g, a.shape));
        });
    }

    std(a, axis = null) {
        const m = this.mean(a, axis);
        const c = this.sub(a, axis === null ? m.data[0] : m);
        return this.sqrt(this.mean(this.mul(c, c), axis));
    }

    max(a, axis = null) {
        if (axis === null) {
            const max = Math.max(...a.data);
            const res = new Tensor([max], {backend: this});
            if (a.requiresGrad) {
                res.requiresGrad = true;
                res._parents = [a];
                res._gradFn = () => this._accumulateGrad(a, this._createTensor(a.data.map(v => v === max ? res.grad.data[0] : 0), a.shape));
            }
            return res;
        }
        return this._reduceAxis(a, axis, v => Math.max(...v), (a, r, ax, as, os, is, bk) => {
            const g = new Array(a.size).fill(0);
            for (let o = 0; o < os; o++) {
                for (let i = 0; i < is; i++) {
                    const ridx = o * is + i;
                    const max = r.data[ridx];
                    for (let x = 0; x < as; x++) {
                        const idx = o * as * is + x * is + i;
                        if (a.data[idx] === max) {
                            g[idx] = r.grad.data[ridx];
                            break;
                        }
                    }
                }
            }
            bk._accumulateGrad(a, bk._createTensor(g, a.shape));
        });
    }

    min(a, axis = null) {
        if (axis === null) {
            const min = Math.min(...a.data);
            const res = new Tensor([min], {backend: this});
            if (a.requiresGrad) {
                res.requiresGrad = true;
                res._parents = [a];
                res._gradFn = () => this._accumulateGrad(a, this._createTensor(a.data.map(v => v === min ? res.grad.data[0] : 0), a.shape));
            }
            return res;
        }
        return this._reduceAxis(a, axis, v => Math.min(...v), (a, r, ax, as, os, is, bk) => {
            const g = new Array(a.size).fill(0);
            for (let o = 0; o < os; o++) {
                for (let i = 0; i < is; i++) {
                    const ridx = o * is + i;
                    const min = r.data[ridx];
                    for (let x = 0; x < as; x++) {
                        const idx = o * as * is + x * is + i;
                        if (a.data[idx] === min) {
                            g[idx] = r.grad.data[ridx];
                            break;
                        }
                    }
                }
            }
            bk._accumulateGrad(a, bk._createTensor(g, a.shape));
        });
    }

    einsum(subscripts, ...tensors) {
        const norm = subscripts.replace(/\s/g, '');
        const patterns = {
            'ij,jk->ik': () => this.matmul(tensors[0], tensors[1]),
            'i,i->': () => this.sum(this.mul(tensors[0], tensors[1])),
            'i,j->ij': () => this.outer(tensors[0], tensors[1]),
            'ij->ji': () => this.transpose(tensors[0]),
            'ii->': () => this.trace(tensors[0]),
            'ij->i': () => this.sum(tensors[0], 1),
            'ij->j': () => this.sum(tensors[0], 0),
        };
        if (patterns[norm]) {
            return patterns[norm]();
        }
        throw new Error(`Einsum pattern '${norm}' not supported.`);
    }

    outer(a, b) {
        if (a.ndim !== 1 || b.ndim !== 1) {
            throw new Error('outer requires 1D tensors');
        }
        const res = this._createTensor(a.data.flatMap(x => b.data.map(y => x * y)), [a.shape[0], b.shape[0]]);
        if (a.requiresGrad || b.requiresGrad) {
            res.requiresGrad = true;
            res._parents = [a, b];
            res._gradFn = () => {
                if (a.requiresGrad) {
                    const g = new Array(a.size).fill(0);
                    for (let i = 0; i < a.size; i++) {
                        for (let j = 0; j < b.size; j++) {
                            g[i] += res.grad.data[i * b.size + j] * b.data[j];
                        }
                    }
                    this._accumulateGrad(a, this._createTensor(g, a.shape));
                }
                if (b.requiresGrad) {
                    const g = new Array(b.size).fill(0);
                    for (let j = 0; j < b.size; j++) {
                        for (let i = 0; i < a.size; i++) {
                            g[j] += res.grad.data[i * b.size + j] * a.data[i];
                        }
                    }
                    this._accumulateGrad(b, this._createTensor(g, b.shape));
                }
            };
        }
        return res;
    }

    trace(a) {
        if (a.ndim !== 2) {
            throw new Error('trace requires 2D tensor');
        }
        const n = Math.min(a.shape[0], a.shape[1]);
        let val = 0;
        for (let i = 0; i < n; i++) {
            val += a.data[i * a.shape[1] + i];
        }
        const res = new Tensor([val], {backend: this});
        if (a.requiresGrad) {
            res.requiresGrad = true;
            res._parents = [a];
            res._gradFn = () => {
                const g = this.zeros(a.shape);
                for (let i = 0; i < n; i++) {
                    g.data[i * a.shape[1] + i] = res.grad.data[0];
                }
                this._accumulateGrad(a, g);
            };
        }
        return res;
    }

    attention(q, k, v, scale = null) {
        const d = scale ?? Math.sqrt(k.shape[k.shape.length - 1]);
        return this.matmul(this.softmax(this.div(this.matmul(q, this.transpose(k)), d), -1), v);
    }

    layerNorm(x, eps = 1e-5) {
        const m = this.mean(x, -1);
        const c = this.sub(x, m);
        const v = this.mean(this.pow(c, 2), -1);
        return this.div(c, this.sqrt(this.add(v, eps)));
    }

    cosineSimilarity(a, b) {
        return this.div(this.sum(this.mul(a, b)), this.mul(this.sqrt(this.sum(this.mul(a, a))), this.sqrt(this.sum(this.mul(b, b)))));
    }

    dropout(x, p = 0.5, training = true) {
        if (!training) {
            return x;
        }
        const mask = this._createTensor(x.data.map(() => Math.random() > p ? 1 : 0), x.shape);
        return this.div(this.mul(x, mask), 1 - p);
    }

    clamp(x, min, max) {
        if (!(x instanceof Tensor)) {
            x = new Tensor([x], {backend: this});
        }
        const res = this._createTensor(x.data.map(v => Math.max(min, Math.min(max, v))), [...x.shape]);
        if (x.requiresGrad) {
            res.requiresGrad = true;
            res._parents = [x];
            res._gradFn = () => {
                const g = x.data.map((v, i) => (v > min && v < max) ? res.grad.data[i] : 0);
                this._accumulateGrad(x, this._createTensor(g, x.shape));
            };
        }
        return res;
    }

    concat(tensors, axis = 0) {
        if (!tensors.length) {
            throw new Error('concat requires tensors');
        }
        if (axis < 0) {
            axis = tensors[0].ndim + axis;
        }
        const shapes = tensors.map(t => t.shape);
        const newShape = [...shapes[0]];
        newShape[axis] = shapes.reduce((s, sh) => s + sh[axis], 0);

        const resData = [];
        const os = shapes[0].slice(0, axis).reduce((a, b) => a * b, 1);
        const is = shapes[0].slice(axis + 1).reduce((a, b) => a * b, 1);

        for (let o = 0; o < os; o++) {
            for (const t of tensors) {
                const as = t.shape[axis];
                for (let x = 0; x < as; x++) {
                    for (let i = 0; i < is; i++) {
                        resData.push(t.data[o * as * is + x * is + i]);
                    }
                }
            }
        }

        const res = this._createTensor(resData, newShape);
        if (tensors.some(t => t.requiresGrad)) {
            res.requiresGrad = true;
            res._parents = tensors;
            res._gradFn = () => {
                let off = 0;
                for (const t of tensors) {
                    if (t.requiresGrad) {
                        this._accumulateGrad(t, this.slice(res.grad, off, off + t.shape[axis], axis));
                    }
                    off += t.shape[axis];
                }
            };
        }
        return res;
    }

    slice(a, start, end, axis = 0) {
        if (!(a instanceof Tensor)) {
            throw new Error('slice requires Tensor');
        }
        if (axis < 0) {
            axis = a.ndim + axis;
        }
        const newShape = [...a.shape];
        newShape[axis] = end - start;

        const resData = [];
        const os = a.shape.slice(0, axis).reduce((a, b) => a * b, 1);
        const is = a.shape.slice(axis + 1).reduce((a, b) => a * b, 1);
        const as = a.shape[axis];

        for (let o = 0; o < os; o++) {
            for (let x = start; x < end; x++) {
                for (let i = 0; i < is; i++) {
                    resData.push(a.data[o * as * is + x * is + i]);
                }
            }
        }

        const res = this._createTensor(resData, newShape);
        if (a.requiresGrad) {
            res.requiresGrad = true;
            res._parents = [a];
            res._gradFn = () => {
                const g = this.zeros(a.shape);
                let idx = 0;
                for (let o = 0; o < os; o++) {
                    for (let x = start; x < end; x++) {
                        for (let i = 0; i < is; i++) {
                            g.data[o * as * is + x * is + i] = res.grad.data[idx++];
                        }
                    }
                }
                this._accumulateGrad(a, g);
            };
        }
        return res;
    }

    unsqueeze(a, axis = 0) {
        if (axis < 0) {
            axis = a.ndim + 1 + axis;
        }
        const s = [...a.shape];
        s.splice(axis, 0, 1);
        return a.reshape(s);
    }

    stack(tensors, axis = 0) {
        return this.concat(tensors.map(t => this.unsqueeze(t, axis)), axis);
    }

    gather(a, indices, axis = 0) {
        if (!(indices instanceof Tensor)) {
            indices = new Tensor(indices, {backend: this});
        }
        if (axis < 0) {
            axis = a.ndim + axis;
        }

        const idxData = indices.data.map(Math.floor);
        const newShape = [...a.shape];
        newShape[axis] = idxData.length;

        const resData = [];
        const os = a.shape.slice(0, axis).reduce((a, b) => a * b, 1);
        const is = a.shape.slice(axis + 1).reduce((a, b) => a * b, 1);
        const as = a.shape[axis];

        for (let o = 0; o < os; o++) {
            for (const idx of idxData) {
                for (let i = 0; i < is; i++) {
                    resData.push(a.data[o * as * is + idx * is + i]);
                }
            }
        }

        const res = this._createTensor(resData, newShape);
        if (a.requiresGrad) {
            res.requiresGrad = true;
            res._parents = [a];
            res._gradFn = () => {
                const g = this.zeros(a.shape);
                let ridx = 0;
                for (let o = 0; o < os; o++) {
                    for (const idx of idxData) {
                        for (let i = 0; i < is; i++) {
                            g.data[o * as * is + idx * is + i] += res.grad.data[ridx++];
                        }
                    }
                }
                this._accumulateGrad(a, g);
            };
        }
        return res;
    }

    randn(shape, mean = 0, std = 1) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Array(size);
        for (let i = 0; i < size; i += 2) {
            const u = 1 - Math.random(), v = Math.random();
            const z1 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            const z2 = Math.sqrt(-2.0 * Math.log(u)) * Math.sin(2.0 * Math.PI * v);
            data[i] = z1 * std + mean;
            if (i + 1 < size) {
                data[i + 1] = z2 * std + mean;
            }
        }
        return this._createTensor(data, shape);
    }

    xavierUniform(shape, gain = 1.0) {
        const fanIn = shape[0], fanOut = shape[1] ?? shape[0];
        const bound = gain * Math.sqrt(6.0 / (fanIn + fanOut));
        return this.sub(this.mul(this.random(shape), 2 * bound), bound);
    }

    kaimingNormal(shape, a = 0, mode = 'fan_in', nonlinearity = 'leaky_relu') {
        const fan = mode === 'fan_in' ? shape[0] : (shape[1] ?? shape[0]);
        const gain = nonlinearity === 'relu' ? Math.sqrt(2.0) : 1.0;
        return this.randn(shape, 0, gain / Math.sqrt(fan));
    }

    forall(a, axis = null) {
        return this.min(a, axis);
    }

    exists(a, axis = null) {
        return this.max(a, axis);
    }

    zeros(shape) {
        return this._createTensor(Array(shape.reduce((a, b) => a * b, 1)).fill(0), shape);
    }

    ones(shape) {
        return this._createTensor(Array(shape.reduce((a, b) => a * b, 1)).fill(1), shape);
    }

    random(shape) {
        return this._createTensor(Array(shape.reduce((a, b) => a * b, 1)).fill(0).map(Math.random), shape);
    }

    full(shape, value) {
        return this._createTensor(Array(shape.reduce((a, b) => a * b, 1)).fill(value), shape);
    }

    empty(shape) {
        return this._createTensor(Array(shape.reduce((a, b) => a * b, 1)), shape);
    }

    arange(start, end, step = 1) {
        const data = [];
        for (let i = start; i < end; i += step) {
            data.push(i);
        }
        return this._createTensor(data, [data.length]);
    }

    linspace(start, end, steps) {
        const data = Array(steps);
        const step = steps > 1 ? (end - start) / (steps - 1) : 0;
        for (let i = 0; i < steps; i++) {
            data[i] = start + i * step;
        }
        return this._createTensor(data, [steps]);
    }

    tensor(data, options = {}) {
        return new Tensor(data, {...options, backend: this});
    }
}

export const T = new NativeBackend();
export const backend = T;
