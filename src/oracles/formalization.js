/**
 * Formalization Oracle — wraps the formalizer through the oracle seam.
 *
 * This makes the formalizer capability available as a faculty via the oracle system.
 */
import { oracleRegistry } from './oracle';
import { createFormalizer } from '../nl/formalizer';
/** Formalization oracle implementation. */
export class FormalizationOracle {
    operation;
    provider;
    version;
    formalizer;
    constructor(config) {
        this.operation = config.operation;
        this.provider = config.provider;
        this.version = config.version;
        this.formalizer = createFormalizer(config.lmService);
    }
    async call(input) {
        const callId = crypto.randomUUID();
        const startTs = Date.now();
        let value;
        try {
            if (input.operation === 'formalization.nlToFormal') {
                const [text, ctx] = input.args;
                value = await this.formalizer.nlToFormal(text, ctx);
            }
            else {
                const [genInput] = input.args;
                value = await this.formalizer.formalToNl(genInput);
            }
        }
        catch (e) {
            throw e;
        }
        finally {
            // Telemetry would be emitted here by the base class mechanism
        }
        return {
            value,
            meta: {
                callId,
                ts: startTs,
                durationMs: Date.now() - startTs,
                provider: this.provider,
                version: this.version,
                pinned: false,
            },
        };
    }
    async isAvailable() {
        return true;
    }
    setPinStore(_store) {
        // Pin store not implemented for formalization oracle yet
    }
    getStats() {
        return {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            pinnedCalls: 0,
            totalDurationMs: 0,
        };
    }
}
/** Create a formalization oracle for nlToFormal. */
export function createNLToFormalOracle(lmService, config = {}) {
    return new FormalizationOracle({
        operation: 'formalization.nlToFormal',
        provider: lmService?.provider ?? 'structured',
        version: lmService?.model,
        lmService,
        ...config,
    });
}
/** Create a formalization oracle for formalToNl. */
export function createFormalToNlOracle(lmService, config = {}) {
    return new FormalizationOracle({
        operation: 'formalization.formalToNl',
        provider: lmService?.provider ?? 'structured',
        version: lmService?.model,
        lmService,
        ...config,
    });
}
/** Register both formalization oracles with the registry. */
export function registerFormalizationOracles(lmService) {
    const oracles = [
        createNLToFormalOracle(lmService),
        createFormalToNlOracle(lmService),
    ];
    for (const oracle of oracles) {
        oracleRegistry.register(oracle);
    }
    return oracles;
}
