import { ambiguitySeverityOf, validateFormalizationBatch } from '@senars/schemas/formalization';
import { asBeliefTruth } from '@senars/types/truth';
import { errMsg } from '@senars/util/error';
import { makeId } from '@senars/util/id';
import { pct } from '@senars/util/format';
import { stableKeyOf } from '@senars/util/json';
import { withDeadline } from '@senars/util/async';
import { SymbolicFirewall } from './firewall';
import { buildUnderstandingPrompt } from './prompts/understanding-v1';
import { TaskBatchSchema } from './schemas';
import { SingleFlight } from './singleflight';
/** The LM fallback paths are the last resort; a slow one must not outlast the cycle. */
const LM_FALLBACK_TIMEOUT_MS = 30_000;
import { parseJsonWith } from '../lm/json';
export class NLUnderstandingService {
    lm;
    structuredOnly;
    firewall;
    flight = new SingleFlight();
    cache;
    constructor(lm, cache, opts) {
        this.lm = lm;
        this.cache = cache;
        this.structuredOnly = opts?.structuredOnly ?? true;
        this.firewall =
            opts?.firewall instanceof SymbolicFirewall
                ? opts.firewall
                : new SymbolicFirewall(opts?.firewall ?? {});
    }
    async understand(input, ctx, maxRetries = 2) {
        const cached = this.cache?.get(input);
        if (cached && typeof cached !== 'string')
            return this.sanitize(this.fromCached(cached));
        const ctxKey = stableKeyOf(ctx ?? null, () => '');
        const result = await this.flight.run(`${maxRetries}::${input}::${ctxKey}`, () => this.understandInner(input, ctx, maxRetries));
        if (result)
            this.cache?.record(input, this.toCached(result));
        return result;
    }
    fromCached(cached) {
        return {
            beliefs: cached.beliefs.map((b) => ({
                narsese: b.narsese,
                ...(b.truth ? { truth: { ...b.truth } } : {}),
                source: 'user',
            })),
            questions: cached.questions.map((narsese) => ({ narsese })),
            goals: cached.goals.map((narsese) => ({ narsese })),
            meta: {
                detectedIntent: 'chat',
                ambiguities: [],
                coreferences: [],
                implicitContext: [],
            },
        };
    }
    toCached(result) {
        return {
            beliefs: result.beliefs.map((b) => ({
                narsese: b.narsese,
                ...(b.truth ? { truth: { ...b.truth } } : {}),
            })),
            questions: result.questions.map((q) => q.narsese),
            goals: result.goals.map((g) => g.narsese),
            summary: '',
        };
    }
    async understandInner(input, ctx, maxRetries = 2) {
        let lastError = null;
        let lastBatch = null;
        // Escalate temperature so deterministic low-temp collapse (e.g. empty
        // batches under grammar) diversifies across attempts.
        const attemptTemps = [undefined, 0.7, 1.0];
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.translateWithLM(input, ctx, lastError, attemptTemps[attempt]);
                if (result) {
                    const empty = result.beliefs.length + result.questions.length + result.goals.length === 0;
                    if (!empty)
                        return this.sanitize(result);
                    lastBatch = result;
                    lastError = 'Empty task batch (no beliefs, questions, or goals)';
                }
                else {
                    lastError = 'No valid output produced';
                }
            }
            catch (e) {
                lastError = errMsg(e);
            }
        }
        return lastBatch;
    }
    async understandCandidates(input, ctx) {
        const batch = await this.understand(input, ctx);
        if (!batch)
            return null;
        return toFormalizationBatch(input, batch);
    }
    sanitize(batch) {
        return {
            ...batch,
            beliefs: batch.beliefs
                .filter((b) => this.firewall.check(b.narsese, 'belief').allowed)
                .map((b) => b.truth && b.source === 'inferred'
                ? { ...b, truth: { ...b.truth, c: this.firewall.clampConfidence(b.truth.c) } }
                : b),
            questions: batch.questions.filter((q) => this.firewall.check(q.narsese, 'question').allowed),
            goals: batch.goals.filter((g) => this.firewall.check(g.narsese, 'goal').allowed),
        };
    }
    async structuredTranslate(prompt, temperature) {
        try {
            if (!this.lm)
                return null;
            return await this.lm.generateObject(prompt, TaskBatchSchema, {
                task: 'structured',
                temperature,
            });
        }
        catch {
            return null;
        }
    }
    async jsonFallbackTranslate(prompt) {
        try {
            const lm = this.lm;
            if (!lm)
                return null;
            const text = await withDeadline((signal) => lm.generateText(prompt + '\n\nRespond with valid JSON only.', {
                task: 'structured',
                maxOutputTokens: 120,
                signal,
            }), LM_FALLBACK_TIMEOUT_MS);
            return parseJsonWith(text, TaskBatchSchema) ?? null;
        }
        catch {
            return null;
        }
    }
    async narseseFallbackTranslate(prompt, input) {
        try {
            const lm = this.lm;
            if (!lm)
                return null;
            const text = await withDeadline((signal) => lm.generateText(prompt + '\n\nRespond with Narsese statements only.', {
                task: 'structured',
                maxOutputTokens: 120,
                signal,
            }), LM_FALLBACK_TIMEOUT_MS);
            return this.extractNarseseFromText(text, input);
        }
        catch {
            return null;
        }
    }
    async translateWithLM(input, ctx, lastError, temperature) {
        if (!this.lm)
            return null;
        const prompt = buildUnderstandingPrompt(input, {
            beliefs: ctx?.beliefs,
            recentExamples: ctx?.recentExamples,
            lastError,
            memorySnapshot: ctx?.memoryHealth
                ? `Memory: ${ctx.memoryHealth.totalConcepts} concepts, pressure ${pct(ctx.memoryHealth.pressure, 0)}`
                : undefined,
        });
        return ((await this.structuredTranslate(prompt, temperature)) ??
            (await this.jsonFallbackTranslate(prompt)) ??
            (await this.narseseFallbackTranslate(prompt, input)));
    }
    isValidNarsese(text) {
        if (!text)
            return false;
        return (this.firewall.check(text, 'belief').allowed ||
            this.firewall.check(text, 'question').allowed ||
            this.firewall.check(text, 'goal').allowed);
    }
    extractNarseseFromText(text, input) {
        const beliefs = [];
        const questions = [];
        const goals = [];
        const narsesePattern = /[(<][^)>]*[)>]/g;
        const matches = text.match(narsesePattern) ?? [];
        for (const match of matches) {
            if (this.isValidNarsese(match)) {
                if (match.startsWith('?')) {
                    questions.push({ narsese: match, context: input });
                }
                else if (match.startsWith('!')) {
                    goals.push({ narsese: match, priority: 0.5 });
                }
                else {
                    beliefs.push({ narsese: match, source: 'user' });
                }
            }
        }
        return {
            beliefs,
            questions,
            goals,
            meta: {
                detectedIntent: 'learning',
                ambiguities: [],
                coreferences: [],
                implicitContext: [],
            },
        };
    }
}
const MODAL_RE = /\b(may|might|must|should|can|could|would|likely|probably)\b/i;
const NEGATION_RE = /\b(unless|not|no\b|never|n't\b|without|except)\b/i;
const QUANTIFIER_RE = /\b(all|every|each|some|most|few|any|none)\b/i;
const TEMPORAL_RE = /\b(when|while|after|before|until|during|always|sometimes)\b/i;
/**
 * One flag per pattern the input matches, its severity read from the kernel's
 * kind table rather than spelled beside the pattern — a second place to keep in step.
 */
export function detectAmbiguityFlags(input) {
    const flags = [];
    const flag = (type, description, options, confidence) => {
        flags.push({ type, description, options, confidence, severity: ambiguitySeverityOf(type) });
    };
    if (NEGATION_RE.test(input))
        flag('negation', 'Negation or exception ("unless", "not", "never") — scope is uncertain', ['narrow-scope', 'wide-scope'], 0.6);
    if (MODAL_RE.test(input))
        flag('modal', 'Modal qualifier ("may", "must", "should") — strength is uncertain', ['strong', 'weak'], 0.6);
    if (QUANTIFIER_RE.test(input))
        flag('quantifier', 'Quantifier ("all", "some", "most") — universality is uncertain', ['universal', 'existential'], 0.55);
    if (TEMPORAL_RE.test(input))
        flag('temporal', 'Temporal marker ("when", "after", "until") — ordering is uncertain', ['sequence', 'implication'], 0.5);
    return flags;
}
export function locateSpan(input, sourceText) {
    if (sourceText) {
        const start = input.indexOf(sourceText);
        if (start >= 0)
            return { start, end: start + sourceText.length, text: sourceText };
    }
    return { start: 0, end: input.length, text: input };
}
export function toFormalizationBatch(input, batch) {
    const candidates = [
        ...batch.beliefs.map((b) => {
            const span = locateSpan(input, b.sourceText);
            return {
                candidateId: makeId(),
                narsese: b.narsese,
                taskType: 'belief',
                ...(b.truth ? { truth: asBeliefTruth(b.truth) } : {}),
                confidence: b.truth?.c ?? (b.source === 'user' ? 0.7 : 0.5),
                sourceSpans: [span],
                ambiguityFlags: detectAmbiguityFlags(span.text),
            };
        }),
        ...batch.questions.map((q) => {
            const span = locateSpan(input, q.sourceText);
            return {
                candidateId: makeId(),
                narsese: q.narsese,
                taskType: 'question',
                confidence: 0.6,
                sourceSpans: [span],
                ambiguityFlags: detectAmbiguityFlags(span.text),
            };
        }),
        ...batch.goals.map((g) => {
            const span = locateSpan(input, g.sourceText);
            return {
                candidateId: makeId(),
                narsese: g.narsese,
                taskType: 'goal',
                confidence: g.priority ?? 0.5,
                sourceSpans: [span],
                ambiguityFlags: detectAmbiguityFlags(span.text),
            };
        }),
    ];
    return validateFormalizationBatch({
        batchId: makeId(),
        sourceText: input,
        candidates,
        detectedIntent: batch.meta.detectedIntent,
        globalAmbiguities: batch.meta.ambiguities.map((a) => ({
            ...a,
            severity: ambiguitySeverityOf(a.type),
        })),
    });
}
