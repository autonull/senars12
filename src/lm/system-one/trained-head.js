/**
 * Sandboxed inference head for System One.
 * Trained weights behind a digest-pinned runtime with feature caching.
 */
import { clamp01, sigmoid } from '@senars/util/numeric';
import { BoundedMap, getOrInsert } from '@senars/util/collections';
import { actionFeatures, ACTION_FEATURE_SEED, GAME_FEATURE_SEED, parseActionFromInstruction } from './features';
/** Feature blocks are a pure function of `(key, dim, seed)`, and a head scores one
 *  candidate per action per call — so the same handful of actions was re-hashed and
 *  re-filled on every score. Bounded through the shared container: a registry of
 *  growing actions must not become an unbounded cache. */
const featureCache = new BoundedMap({ maxSize: 256, eviction: 'lru' });
const cachedActionFeatures = (key, dim, seed) => getOrInsert(featureCache, `${seed}:${dim}:${key}`, () => actionFeatures(key, dim, seed));
/**
 * Inference head: scores (embedding, action, game?) → [0, 1] value.
 * Weights are frozen at construction; config is validated via HeadArtifactConfigSchema.
 */
export class TrainedLinearHead {
    rubric;
    axis;
    fitted = true;
    modelDigest;
    #config;
    #weights;
    #bias;
    constructor(config, weightsBytes, modelDigest) {
        this.#config = config;
        this.rubric = config.rubric;
        this.axis = config.axis;
        this.modelDigest = modelDigest;
        const floats = new Float32Array(weightsBytes.buffer.slice(weightsBytes.byteOffset, weightsBytes.byteOffset + weightsBytes.byteLength - 4));
        this.#weights = floats;
        this.#bias = weightsBytes.readFloatLE(weightsBytes.byteLength - 4);
    }
    static fromBundle(bundle) {
        return new TrainedLinearHead(bundle.config, bundle.weightsBytes, bundle.modelDigest);
    }
    score(embedding, action, game) {
        const { mean, std, embeddingDim, actionFeatureDim, gameFeatureDim, kind } = this.#config;
        const weights = this.#weights;
        const actionBlock = actionFeatureDim > 0 ? cachedActionFeatures(action, embeddingDim, ACTION_FEATURE_SEED) : null;
        const gameBlock = gameFeatureDim > 0 && game
            ? cachedActionFeatures(game, gameFeatureDim, GAME_FEATURE_SEED)
            : null;
        let z = this.#bias;
        for (let i = 0; i < embeddingDim; i++) {
            const f = actionBlock ? embedding[i] * actionBlock[i] : embedding[i];
            z += (weights[i] * (f - mean[i])) / std[i];
        }
        for (let i = 0; i < gameFeatureDim; i++) {
            const j = embeddingDim + i;
            z += (weights[j] * ((gameBlock?.[i] ?? 0) - mean[j])) / std[j];
        }
        return kind === 'logistic' ? sigmoid(z) : clamp01(z);
    }
    async evaluate(embedding, query) {
        const action = parseActionFromInstruction(query.instruction);
        const game = query.instruction.match(/game (\S+)/)?.[1];
        return { score: this.score(embedding, action, game), abstained: false };
    }
}
