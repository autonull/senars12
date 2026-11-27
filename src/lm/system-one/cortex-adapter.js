import { collectUpTo, takeFirst } from '@senars/util/collections';
import { splitLines } from '@senars/util/text';
import { candidateSlots, nextCandidateSlot, NO_COST, synthesisCandidateCount } from './types';
export class LMServiceCortex {
    #lmService;
    #defaultGrammar;
    #temperature;
    #model;
    constructor(config) {
        this.#lmService = config.lmService;
        this.#defaultGrammar = config.grammar ?? 'narsese-term';
        this.#temperature = config.temperature ?? 0;
        this.#model = config.model;
    }
    /** Diagnostic introspection (Phase F, audit M4) — replaces private-name `?.` chains. */
    describe() {
        return { grammar: this.#defaultGrammar, temperature: this.#temperature, model: this.#model };
    }
    /** Runtime tuning for the `.cortex model|grammar` CLI commands (audit M4). */
    setRuntimeTuning(tuning) {
        if (tuning.grammar !== undefined)
            this.#defaultGrammar = tuning.grammar;
        if (tuning.model !== undefined)
            this.#model = tuning.model;
    }
    async *synthesize(context, query, _budget) {
        const maxCandidates = synthesisCandidateCount(query);
        const grammar = query.grammar ?? this.#defaultGrammar;
        const prompt = query.promptOverride ?? this.buildPrompt(context, query.instruction, maxCandidates);
        try {
            const text = await this.#lmService.generateText(prompt, {
                temperature: this.#temperature,
                grammar,
                model: this.#model,
            });
            const candidates = this.parseCandidates(text, maxCandidates);
            yield {
                kind: 'synthesize',
                candidates,
                cost: NO_COST,
            };
        }
        catch (_error) {
            const stubCandidates = candidateSlots(maxCandidates);
            yield {
                kind: 'synthesize',
                candidates: stubCandidates,
                cost: NO_COST,
            };
        }
    }
    health() {
        return { provider: 'lm-service', breakerOpen: false };
    }
    buildPrompt(context, instruction, maxCandidates) {
        const beliefs = takeFirst(context.topBeliefs, 5).join('\n');
        const goals = takeFirst(context.topGoals, 3).join('\n');
        const wm = takeFirst(context.workingMemory, 3).join('\n');
        return `Top Beliefs:
${beliefs || '(none)'}

Top Goals:
${goals || '(none)'}

Working Memory:
${wm || '(none)'}

Instruction: ${instruction}

Generate up to ${maxCandidates} Narsese candidates. One per line, no extra text.`;
    }
    parseCandidates(text, maxCandidates) {
        const lines = splitLines(text).filter((l) => !l.startsWith('#') && !l.startsWith('//'));
        // Strip potential markdown code fences
        const candidates = collectUpTo(lines, maxCandidates, (line) => {
            const cleaned = line
                .replace(/^```\w*\n?/, '')
                .replace(/\n?```$/, '')
                .trim();
            return cleaned || undefined;
        });
        while (candidates.length < maxCandidates) {
            candidates.push(nextCandidateSlot(candidates.length));
        }
        return candidates.slice(0, maxCandidates);
    }
}
export function createLMServiceCortex(config) {
    return new LMServiceCortex(config);
}
