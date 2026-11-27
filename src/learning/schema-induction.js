/**
 * Schema Induction - Induces reusable schemas from successful derivation patterns
 *
 * From successful derivation patterns, induces reusable schemas:
 * - "If A→B and B→C then A→C" (transitivity schema)
 * - "If X causes Y and Y causes Z then X causes Z" (causal chain)
 * - Store as higher-order concepts with variables
 * - LM proposes, NARS validates, both adopt
 */
var _a;
import { ambientRng } from '@senars/util/random';
import { parseJsonObject } from '@senars/util/json';
import { clamp01 } from '@senars/util/numeric';
import { createLogger } from '@senars/util/logger';
import { generateId } from '@senars/util/id';
import { LruCache } from '@senars/util/lru-cache';
import { minBy, sortBy } from '@senars/util/collections';
import { errMsg } from '@senars/util/error';
import { containsSubterm, getSubject, Truth, termKey } from '../terms';
/** Serialized chain terms — the single rendering behind signatures, templates, and instances. */
const chainTerms = (chain) => chain.map((t) => t.term.toString());
/**
 * Canonical identity of a chain, for novelty dedup only. The rendered signature
 * is what a human reads and what a schema is named by, so it cannot double as
 * the dedup key: two chains whose terms serialize alike would collapse into one.
 */
const chainIdentity = (chain) => chain.map((t) => termKey(t.term)).join('→');
import { AIKRProcessor, createAikrBag, BagPrioritySampling, } from './aikr-processor';
const DEFAULT_CONFIG = {
    enableSchemaInduction: true,
    minDerivationSteps: 3,
    minConfidenceForInduction: 0.6,
    maxSchemas: 50,
    inductionIntervalMs: 300_000,
    capacity: 256,
    pressureThreshold: 0.7,
};
export class SchemaInductor {
    memory;
    lmClient;
    config;
    logger;
    schemas = new Map();
    lastInductionTime = 0;
    rng;
    /** Phase C (REFACTOR.todo1): AIKR-bounded chain accumulation + processing. */
    #chainBag = createAikrBag({ capacity: 256 });
    #processor;
    static #SEEN_SIGNATURE_CAP = 4096;
    #seenSignatures = new LruCache(_a.#SEEN_SIGNATURE_CAP);
    constructor(memory, lmClient, config = {}) {
        this.memory = memory;
        this.lmClient = lmClient;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.rng = config.rng ?? ambientRng;
        this.logger = createLogger({ scope: 'learning:schema-induction' });
        this.#chainBag = createAikrBag({
            capacity: this.config.capacity ?? 256,
            forgetRate: this.config.forgetRate,
            rng: this.rng,
        });
        this.#processor = new AIKRProcessor({
            bag: this.#chainBag,
            samplingStrategy: new BagPrioritySampling(1.0),
            pressureThreshold: this.config.pressureThreshold ?? 0.7,
            rng: this.rng,
            process: (items, signal) => this.#induceChains(items, signal),
        });
    }
    /** Phase C: continuous admission from the derivation-chain sink (novelty × length). */
    onDerivation(chain) {
        if (!this.config.enableSchemaInduction || chain.length === 0)
            return;
        const identity = chainIdentity(chain);
        if (this.#seenSignatures.has(identity))
            return;
        this.#seenSignatures.set(identity, true);
        const signature = chainTerms(chain).join('→');
        this.#processor.admit({
            id: signature,
            priority: chain.length,
            chain: [...chain],
            signature,
        });
    }
    /** Micro-tick-compatible induction: inert below pressure 0.7, interruptible. */
    async induceIfPressured(options = {}) {
        return this.#processor.processIfPressured(options);
    }
    /** Explicit drain (CLI `.schemas-induce`): ignores the pressure gate. */
    async induceNow(options = {}) {
        return this.#processor.process(options);
    }
    /** Phase C: decay stale chains (call per cycle). */
    decayChains(rate) {
        this.#processor.decay(rate);
    }
    get chainPressure() {
        return this.#processor.pressure();
    }
    async #induceChains(items, signal) {
        const results = [];
        for (const item of items) {
            if (signal?.aborted)
                break;
            try {
                const induced = await this.induceSchema(item.chain);
                if (induced) {
                    results.push(induced);
                    continue;
                }
                // LM returned nothing parseable → symbolic structural induction.
                const symbolic = this.#symbolicInduction(item.chain);
                if (symbolic)
                    results.push(symbolic);
            }
            catch {
                // LM unavailable/failed → symbolic structural induction fallback.
                const symbolic = this.#symbolicInduction(item.chain);
                if (symbolic)
                    results.push(symbolic);
            }
        }
        return results;
    }
    /** Deterministic structural induction — no LM: abstract chain terms into variables. */
    #symbolicInduction(chain) {
        if (chain.length < this.config.minDerivationSteps)
            return null;
        const terms = chainTerms(chain);
        const variables = terms.map((_, i) => `?V${i + 1}`);
        const template = terms.map((t, i) => `${variables[i]}:${t}`).join(' → ');
        const confidences = chain.map((t) => (t.truth ? Truth.attention(t.truth) : 0));
        const confidence = clamp01(minBy(confidences, (c) => c));
        if (confidence < this.config.minConfidenceForInduction)
            return null;
        const id = generateId('schema-sym', this.rng);
        const schema = {
            id,
            template,
            variables,
            examples: [terms.join(' → ')],
            confidence,
            usageCount: 0,
            lastUsed: Date.now(),
        };
        this.schemas.set(id, schema);
        this.enforceMaxSchemas();
        return { schema, instances: terms, confidence };
    }
    async induceFromDerivations(derivations) {
        if (!this.config.enableSchemaInduction || derivations.length === 0)
            return [];
        const now = Date.now();
        if (now - this.lastInductionTime < this.config.inductionIntervalMs)
            return [];
        this.lastInductionTime = now;
        const patterns = this.extractPatterns(derivations);
        if (patterns.length === 0)
            return [];
        const results = [];
        for (const pattern of patterns) {
            try {
                const induced = await this.induceSchema(pattern);
                if (induced)
                    results.push(induced);
            }
            catch (error) {
                this.logger.warn(`Schema induction failed: ${errMsg(error)}`);
            }
        }
        return results;
    }
    getSchemas() {
        return Array.from(this.schemas.values());
    }
    getSchema(id) {
        return this.schemas.get(id);
    }
    extractPatterns(derivations) {
        const chains = [];
        let current = [];
        for (const d of derivations) {
            if (!d.truth)
                continue;
            const confidence = Truth.attention(d.truth);
            if (confidence < this.config.minConfidenceForInduction)
                continue;
            if (current.length > 0) {
                const lastTask = current[current.length - 1];
                const subject = getSubject(d.term);
                if (containsSubterm(d.term, lastTask.term) ||
                    (subject && containsSubterm(lastTask.term, subject))) {
                    current.push(d);
                    continue;
                }
            }
            if (current.length >= this.config.minDerivationSteps) {
                chains.push(current);
            }
            current = [d];
        }
        if (current.length >= this.config.minDerivationSteps)
            chains.push(current);
        return chains;
    }
    async induceSchema(chain) {
        const chainStr = chainTerms(chain).join(' → ');
        const prompt = `Analyze this derivation chain and extract a reusable schema pattern.

Chain: ${chainStr}

Identify:
1. The general pattern (use variables like ?A, ?B, ?C for specific terms)
2. What type of reasoning pattern this is
3. How confident you are this is a reusable schema

Respond with JSON:
{
  "pattern": "(?A --> ?B) & (?B --> ?C) ==> (?A --> ?C)",
  "type": "transitivity",
  "confidence": 0.8,
  "variables": ["?A", "?B", "?C"]
}`;
        const response = await this.lmClient.generateText(prompt);
        const parsed = this.parseSchemaResponse(response);
        if (!parsed)
            return null;
        const id = generateId('schema', this.rng);
        const schema = {
            id,
            template: parsed.pattern,
            variables: parsed.variables,
            examples: [chainStr],
            confidence: parsed.confidence,
            usageCount: 0,
            lastUsed: Date.now(),
        };
        this.schemas.set(id, schema);
        this.enforceMaxSchemas();
        return { schema, instances: chainTerms(chain), confidence: parsed.confidence };
    }
    parseSchemaResponse(response) {
        try {
            const obj = parseJsonObject(response);
            if (typeof obj?.pattern !== 'string' || !Array.isArray(obj.variables))
                return null;
            return {
                pattern: obj.pattern,
                type: typeof obj.type === 'string' ? obj.type : 'unknown',
                confidence: clamp01(typeof obj.confidence === 'number' ? obj.confidence : 0.5),
                variables: obj.variables.filter((v) => typeof v === 'string'),
            };
        }
        catch {
            return null;
        }
    }
    enforceMaxSchemas() {
        if (this.schemas.size <= this.config.maxSchemas)
            return;
        const sorted = sortBy(this.schemas.values(), (s) => s.usageCount - s.confidence);
        const toRemove = sorted.slice(0, this.schemas.size - this.config.maxSchemas);
        for (const s of toRemove) {
            this.schemas.delete(s.id);
        }
    }
}
_a = SchemaInductor;
export const createSchemaInductor = (memory, lmClient, config) => {
    return new SchemaInductor(memory, lmClient, config);
};
