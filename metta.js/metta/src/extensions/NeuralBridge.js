/**
 * NeuralBridge.js
 * MORK-parity Phase P3-C: Neural Bridge — MeTTa <-> Tensor Logic
 */
import {TensorFunctor} from '@senars/tensor/TensorFunctor.js';

export class NeuralBridge {
    static register(ground) {
        const tensorFunctor = new TensorFunctor();

        for (const opName of TensorFunctor._TENSOR_OPS) {
            const mettaOpName = opName.replace(/_/g, '-');
            ground.register(mettaOpName, (...args) => {
                // Resolve MeTTa list structures (like [500, 500]) or symbols to actual numbers/arrays
                const resolveArg = (arg) => {
                    if (Array.isArray(arg)) {
                        return arg.map(resolveArg);
                    }
                    if (arg && typeof arg === 'object') {
                        if (arg.name && !isNaN(Number(arg.name))) {
                            return Number(arg.name);
                        }
                        // Check if it's a list: `(: 500 (: 500 ()))` -> array `[500, 500]`
                        // First check if it's formatted as `[]` representation
                        if (arg.operator && arg.operator.name === '()') {
                            return [];
                        }
                        if (arg.operator && arg.operator.name === '[]' && arg.components) {
                            return arg.components.map(resolveArg);
                        }

                        // Fallback for simple compounds like `(500 500)` if not strictly a typed list
                        if ((arg.type === 'compound' || arg.components)) {
                            // Include operator if it's treated as the first element of the list
                            const els = arg.operator ? [arg.operator, ...arg.components] : arg.components;
                            return els.map(resolveArg);
                        }
                    }
                    return arg;
                };
                const resolvedArgs = args.map(resolveArg);

                return tensorFunctor.evaluate({operator: opName, components: resolvedArgs}, new Map());
            });
        }
    }
}
