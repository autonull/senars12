import { appendTextDelta, collectText } from '@senars/util/text';
import { estimateTokens } from '@senars/util/numeric';
import { formatTruth } from '@senars/types/truth';
export class LLMCortex {
    #runner;
    #promptBuilder;
    constructor(runner, promptBuilder) {
        this.#runner = runner;
        this.#promptBuilder = promptBuilder;
    }
    setPromptBuilder(builder) {
        this.#promptBuilder = builder;
    }
    async *synthesizeStream(req, signal) {
        const composed = this.#compose(req);
        let text = '';
        for await (const ev of this.#runner.run(composed, signal)) {
            yield this.#toChatEvent(ev);
            text = appendTextDelta(text, ev);
        }
        const finalText = text || this.#fallbackResponse(req);
        if (!text)
            yield { kind: 'text-delta', text: finalText };
        return finalText;
    }
    async synthesize(req) {
        const events = [];
        const text = await collectText(this.#runner.run(this.#compose(req)), (ev) => events.push(this.#toChatEvent(ev)));
        return { text: text || this.#fallbackResponse(req), events };
    }
    #compose(req) {
        const systemPrompt = req.systemPrompt ?? this.#buildDefaultPrompt(req);
        const historyText = req.context.working.map((e) => JSON.stringify(e)).join('\n');
        const systemTokens = estimateTokens(systemPrompt);
        const historyTokens = estimateTokens(historyText) + estimateTokens(req.stimulus.text);
        return {
            system: systemPrompt,
            messages: [{ role: 'user', content: req.stimulus.text }],
            tools: req.tools ?? {},
            tier: req.tier,
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {
                systemTokens,
                historyTokens,
                snapshotTokens: 0,
                total: systemTokens + historyTokens,
                maxTokens: req.maxTokens ?? 0,
            },
        };
    }
    #toChatEvent(ev) {
        switch (ev.kind) {
            case 'text-delta':
                return { kind: 'text-delta', text: ev.text };
            case 'tool-call':
                return { kind: 'tool-call', toolName: ev.call.toolName, toolArgs: ev.call.args };
            case 'tool-result':
                return {
                    kind: 'tool-result',
                    toolName: ev.call.toolName,
                    toolArgs: ev.call.args,
                    toolResult: ev.result,
                };
            case 'finish':
                return { kind: 'finish', text: ev.text };
            case 'tool-error':
                return { kind: 'error', error: ev.error };
        }
    }
    #buildDefaultPrompt(req) {
        const derivations = req.derivations
            .map((d) => `- ${d.term}${d.truth ? ` ${formatTruth(d.truth)}` : ''}`)
            .join('\n');
        return [
            'You are a cognitive agent with access to symbolic reasoning engines.',
            'Synthesize a natural language response based on the input and any derivations.',
            '',
            derivations ? `Relevant derivations:\n${derivations}` : '',
            '',
            this.#promptBuilder
                ? this.#promptBuilder.build({
                    ...req,
                    workingMemory: req.context.working,
                })
                : '',
        ]
            .filter(Boolean)
            .join('\n');
    }
    #fallbackResponse(req) {
        if (req.derivations.length > 0) {
            return `I derived ${req.derivations.length} result(s).`;
        }
        return `[agent] ${req.stimulus.text}`;
    }
}
