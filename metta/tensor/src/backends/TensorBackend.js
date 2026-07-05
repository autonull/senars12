/**
 * TensorBackend - Abstract interface for tensor operations
 *
 * Implementations provide the actual computation backend (native JS, TFJS, ONNX, etc.)
 */
export class TensorBackend {
    constructor() {
        if (this.constructor === TensorBackend) {
            throw new Error('TensorBackend is abstract and cannot be instantiated directly');
        }
    }

    // === Binary operations ===
    matmul(a, b) {
        throw new Error('Not implemented');
    }

    add(a, b) {
        throw new Error('Not implemented');
    }

    sub(a, b) {
        throw new Error('Not implemented');
    }

    mul(a, b) {
        throw new Error('Not implemented');
    }

    div(a, b) {
        throw new Error('Not implemented');
    }

    // === Unary operations ===
    transpose(a) {
        throw new Error('Not implemented');
    }

    reshape(a, shape) {
        throw new Error('Not implemented');
    }

    neg(a) {
        throw new Error('Not implemented');
    }

    // === Activation functions ===
    relu(a) {
        throw new Error('Not implemented');
    }

    sigmoid(a) {
        throw new Error('Not implemented');
    }

    tanh(a) {
        throw new Error('Not implemented');
    }

    softmax(a, axis = -1) {
        throw new Error('Not implemented');
    }

    gelu(a) {
        throw new Error('Not implemented');
    }

    // === Reduction operations ===
    sum(a, axis = null) {
        throw new Error('Not implemented');
    }

    mean(a, axis = null) {
        throw new Error('Not implemented');
    }

    max(a, axis = null) {
        throw new Error('Not implemented');
    }

    min(a, axis = null) {
        throw new Error('Not implemented');
    }

    // === Mathematical operations ===
    exp(a) {
        throw new Error('Not implemented');
    }

    log(a) {
        throw new Error('Not implemented');
    }

    sqrt(a) {
        throw new Error('Not implemented');
    }

    pow(a, n) {
        throw new Error('Not implemented');
    }

    abs(a) {
        throw new Error('Not implemented');
    }

    // === Quantifiers ===
    forall(a, axis = null) {
        throw new Error('Not implemented');
    }

    exists(a, axis = null) {
        throw new Error('Not implemented');
    }

    // === Utilities ===
    zeros(shape) {
        throw new Error('Not implemented');
    }

    ones(shape) {
        throw new Error('Not implemented');
    }

    random(shape) {
        throw new Error('Not implemented');
    }
}
