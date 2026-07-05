import {Tensor} from './Tensor.js';

export class LossFunctor {
    constructor(backend = null) {
        this.backend = backend;
    }

    _clipTensor(tensor, eps) {
        return this.backend.clamp(tensor, eps, 1 - eps);
    }

    mse(predicted, target) {
        const diff = this.backend.sub(predicted, target);
        return this.backend.mean(this.backend.mul(diff, diff));
    }

    mae(predicted, target) {
        const diff = this.backend.sub(predicted, target);
        return this.backend.mean(this.backend.abs(diff));
    }

    binaryCrossEntropy(predicted, target, eps = 1e-7) {
        const clipped = this._clipTensor(predicted, eps);
        const logP = this.backend.log(clipped);
        const oneMinusClipped = this.backend.sub(this.backend.ones(clipped.shape), clipped);
        const log1MinusP = this.backend.log(oneMinusClipped);
        const term1 = this.backend.mul(target, logP);
        const oneMinusTarget = this.backend.sub(this.backend.ones(target.shape), target);
        const term2 = this.backend.mul(oneMinusTarget, log1MinusP);
        const negSum = this.backend.neg(this.backend.add(term1, term2));
        return this.backend.mean(negSum);
    }

    crossEntropy(predicted, target, eps = 1e-7) {
        const clipped = this._clipTensor(predicted, eps);
        const logP = this.backend.log(clipped);
        const prod = this.backend.mul(target, logP);
        const loss = this.backend.neg(this.backend.sum(prod));
        return this.backend.mean(loss);
    }
}
