import {Tensor} from './Tensor.js';

const TensorOps = {
    reshape(flat, shape) {
        if (shape.length === 1) {
            return Array.from(flat);
        }
        if (shape.length === 2) {
            const [rows, cols] = shape;
            return Array.from({length: rows}, (_, i) =>
                Array.from(flat.slice(i * cols, (i + 1) * cols))
            );
        }
        return Array.from(flat);
    },

    makeMask(length, symbolMask, symbols) {
        const mask = new Float32Array(length);
        symbols.forEach((annotation, i) => {
            if (annotation && symbolMask.has(annotation.symbol)) {
                mask[i] = 1.0;
            }
        });
        return mask;
    },

    softmax(data, symbolWeights = null, shape) {
        const expData = new Float32Array(data.map(Math.exp));
        const sum = expData.reduce((a, b) => a + b, 0);
        const result = expData.map(v => v / sum);

        if (symbolWeights) {
            symbolWeights.forEach((weight, key) => {
                const idx = parseInt(key);
                if (!isNaN(idx) && idx < result.length) {
                    result[idx] *= weight;
                }
            });
        }

        return new SymbolicTensor(result, shape);
    }
};

export class SymbolicTensor extends Tensor {
    constructor(data, shape, config = {}) {
        let tensorData = data instanceof Float32Array || data instanceof Array
            ? Array.from(data)
            : data;

        if (shape) {
            tensorData = TensorOps.reshape(tensorData, shape);
        }

        super(tensorData, config);
        this.symbols = config.symbols || new Map();
        this.provenance = config.provenance || [];
        this.confidence = config.confidence ?? 1.0;
        this.type = config.type || 'tensor';

        if (shape) {
            this.shape = shape;
        }
    }

    static _reshapeData(flat, shape) {
        return TensorOps.reshape(flat, shape);
    }

    static fromJSON(json) {
        return new SymbolicTensor(json.data, json.shape, {
            symbols: new Map(json.symbols),
            provenance: json.provenance,
            confidence: json.confidence,
            type: json.type
        });
    }

    annotate(indices, symbol, confidence = 1.0) {
        const key = Array.isArray(indices) ? indices.join(',') : String(indices);
        this.symbols.set(key, {symbol, confidence, timestamp: Date.now()});
        return this;
    }

    getAnnotation(indices) {
        const key = Array.isArray(indices) ? indices.join(',') : String(indices);
        return this.symbols.get(key);
    }

    addProvenance(source, operation, metadata = {}) {
        this.provenance.push({source, operation, metadata, timestamp: Date.now()});
        return this;
    }

    toNarseseTerm(prefix = 'tensor') {
        const flatData = this.data.map(v => v.toFixed(4));
        const symbolParts = Array.from(this.symbols)
            .map(([_, {symbol, confidence}]) => `${symbol}:${confidence.toFixed(2)}`);

        return symbolParts.length > 0
            ? `(${prefix}_${this.shape.join('x')}:[${symbolParts.join(',')}])`
            : `(${prefix}_${this.shape.join('x')}:[${flatData.join(',')}])`;
    }

    _getIndices(flatIndex) {
        if (!this.shape || this.shape.length <= 1) {
            return [flatIndex];
        }
        return this.indexToCoords(flatIndex);
    }

    projectToSymbols(threshold = 0.5) {
        return Array.from(this.data)
            .map((value, i) => {
                // Try to find annotation by flat index (legacy/1D) or coordinate index
                let key = String(i);
                let annotation = this.symbols.get(key);

                if (!annotation && this.shape && this.shape.length > 1) {
                    key = this._getIndices(i).join(',');
                    annotation = this.symbols.get(key);
                }

                if (annotation && annotation.confidence >= threshold) {
                    return {index: i, symbol: annotation.symbol, value, confidence: annotation.confidence};
                }
                if (Math.abs(value) >= threshold) {
                    return {index: i, symbol: `feature_${i}`, value, confidence: 0.5};
                }
                return null;
            })
            .filter(Boolean);
    }

    clone() {
        const cloned = new SymbolicTensor(
            new Float32Array(this.data),
            this.shape,
            {
                symbols: new Map(this.symbols),
                provenance: [...this.provenance],
                confidence: this.confidence,
                type: this.type,
                requiresGrad: this.requiresGrad,
                backend: this.backend
            }
        );
        if (this.grad) {
            cloned.grad = new Float32Array(this.grad);
        }
        if (this._gradFn) {
            cloned._gradFn = this._gradFn;
        }
        if (this._parents) {
            cloned._parents = [...this._parents];
        }
        return cloned;
    }

    toJSON() {
        return {
            data: Array.from(this.data),
            shape: this.shape,
            symbols: Array.from(this.symbols.entries()),
            provenance: this.provenance,
            confidence: this.confidence,
            type: this.type,
            requiresGrad: this.requiresGrad
        };
    }
}

export function symbolicTensor(data, shape, symbols = {}) {
    const tensor = new SymbolicTensor(data, shape);

    Object.entries(symbols).forEach(([key, value]) => {
        const indices = key.split(',').map(Number);
        tensor.annotate(indices.length === 1 ? indices[0] : indices, value);
    });

    return tensor;
}

export {TensorOps};
