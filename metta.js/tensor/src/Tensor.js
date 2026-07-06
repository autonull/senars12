export class Tensor {
    constructor(data, {requiresGrad = false, backend = null} = {}) {
        this.data = this._flatten(data);
        this.shape = this._inferShape(data);
        this.requiresGrad = requiresGrad;
        this.backend = backend;
        this.grad = null;
        this._gradFn = null;
        this._parents = [];
    }

    get ndim() {
        return this.shape.length;
    }

    get size() {
        return this.shape.reduce((a, b) => a * b, 1);
    }

    get isTensor() {
        return true;
    }

    static fromJSON(json) {
        return new Tensor(json.data, {requiresGrad: json.requiresGrad ?? false});
    }

    _inferShape(data) {
        if (!Array.isArray(data)) {
            return [1];
        }
        const shape = [];
        for (let curr = data; Array.isArray(curr); curr = curr[0]) {
            shape.push(curr.length);
        }
        return shape;
    }

    _flatten(data) {
        if (!Array.isArray(data)) {
            return [Number(data)];
        }
        return data.flat(Infinity).map(Number);
    }

    _unflatten(flat, shape) {
        if (shape.length === 1) {
            return flat.slice(0, shape[0]);
        }
        const stride = shape.slice(1).reduce((a, b) => a * b, 1);
        return Array.from({length: shape[0]}, (_, i) =>
            this._unflatten(flat.slice(i * stride, (i + 1) * stride), shape.slice(1)));
    }

    reshape(newShape) {
        if (newShape.reduce((a, b) => a * b, 1) !== this.size) {
            throw new Error(`Cannot reshape size ${this.size} to ${newShape}`);
        }

        const t = new Tensor([...this.data], {requiresGrad: this.requiresGrad, backend: this.backend});
        t.shape = [...newShape];
        return t;
    }

    transpose(axes) {
        axes ??= this.ndim === 2 ? [1, 0] : Array.from({length: this.ndim}, (_, i) => this.ndim - 1 - i);
        if (axes.length !== this.ndim) {
            throw new Error(`Transpose axes must match ndim ${this.ndim}`);
        }

        const newShape = axes.map(i => this.shape[i]);
        const newData = Array(this.size);
        const oldStrides = this._computeStrides(this.shape);
        const newStrides = this._computeStrides(newShape);

        for (let i = 0; i < this.size; i++) {
            const newCoords = this._indexToCoords(i, newStrides);
            const oldCoords = axes.map((_, idx) => newCoords[axes.indexOf(idx)]); // Inverse mapping
            // Correct logic: oldCoords[axes[k]] = newCoords[k]
            const mappedCoords = Array(this.ndim);
            for (let k = 0; k < this.ndim; k++) {
                mappedCoords[axes[k]] = newCoords[k];
            }

            newData[i] = this.data[this._coordsToIndex(mappedCoords, oldStrides)];
        }

        const t = new Tensor(0, {requiresGrad: this.requiresGrad, backend: this.backend});
        t.data = newData;
        t.shape = newShape;
        return t;
    }

    _computeStrides(shape) {
        const strides = Array(shape.length);
        strides[shape.length - 1] = 1;
        for (let i = shape.length - 2; i >= 0; i--) {
            strides[i] = strides[i + 1] * shape[i + 1];
        }
        return strides;
    }

    _indexToCoords(index, strides) {
        return strides.map(s => {
            const c = Math.floor(index / s);
            index %= s;
            return c;
        });
    }

    _coordsToIndex(coords, strides) {
        return coords.reduce((sum, c, i) => sum + c * strides[i], 0);
    }

    indexToCoords(index) {
        const strides = this._computeStrides(this.shape);
        return strides.map(s => {
            const c = Math.floor(index / s);
            index %= s;
            return c;
        });
    }

    toJSON() {
        return {data: this.toArray(), shape: this.shape, requiresGrad: this.requiresGrad};
    }

    toArray() {
        return this._unflatten(this.data, this.shape);
    }

    toString() {
        return `Tensor(shape=${this.shape.join('x')}, data=${JSON.stringify(this.toArray())})`;
    }

    item() {
        if (this.size !== 1) {
            throw new Error(`item() requires scalar, got ${this.shape}`);
        }
        return this.data[0];
    }

    numpy() {
        return this.toArray();
    }

    clone() {
        const t = new Tensor([...this.data], {requiresGrad: this.requiresGrad, backend: this.backend});
        t.shape = [...this.shape];
        return t;
    }

    get(indices) {
        if (!Array.isArray(indices)) {
            indices = [indices];
        }
        return this.data[this._coordsToIndex(indices, this._computeStrides(this.shape))];
    }

    set(indices, value) {
        if (!Array.isArray(indices)) {
            indices = [indices];
        }
        this.data[this._coordsToIndex(indices, this._computeStrides(this.shape))] = value;
    }

    backward() {
        if (!this.requiresGrad) {
            return;
        }
        this.grad ??= this.backend?.ones(this.shape) ??
            Object.assign(new Tensor(Array(this.size).fill(1), {backend: this.backend}), {shape: [...this.shape]});

        const topo = [], visited = new Set();
        const dfs = t => {
            if (visited.has(t) || !t.requiresGrad) {
                return;
            }
            visited.add(t);
            t._parents?.forEach(dfs);
            topo.push(t);
        };
        dfs(this);
        topo.reverse().forEach(t => t._gradFn?.());
    }

    zeroGrad() {
        this.grad = null;
        this._parents?.forEach(p => p.zeroGrad?.());
    }
}
