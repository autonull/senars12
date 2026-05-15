import {classify} from '../nar/nl/classifier.js';
import type {NLTranslator} from '../nar/nl/translator.js';
import type {NAR} from '../nar/nar.js';
import type {OutputRenderer} from './display.js';
import type {CommandHandlers} from './command-handlers.js';
import {InputTracer, getGlobalTracer, LoopDetectionError, TimeoutError} from '../nar/trace/index.js';

const DEFAULT_TIMEOUT_MS = 5000;

export class InputPipeline {
    private readonly tracer: InputTracer;
    private readonly timeoutMs: number;

    constructor(
        private nar: NAR,
        private translator: NLTranslator | undefined,
        private renderer: OutputRenderer,
        private commands?: CommandHandlers,
        timeoutMs = DEFAULT_TIMEOUT_MS,
    ) {
        this.tracer = getGlobalTracer();
        this.timeoutMs = timeoutMs;
    }

    async process(input: string): Promise<void> {
        const type = classify(input);
        this.tracer.start(`process:${type}`);
        this.tracer.event('input_start', `Processing ${type}: ${input.slice(0, 50)}...`);

        try {
            await this.withTimeout(() => this.doProcess(input, type));
        } catch (err) {
            if (err instanceof LoopDetectionError) {
                this.renderer.error(`LOOP DETECTED: ${err.message}`);
                this.renderer.info('Trace: ' + this.tracer.formatTrace());
            } else if (err instanceof TimeoutError) {
                this.renderer.error(`TIMEOUT: ${err.message}`);
                this.renderer.info('Trace: ' + this.tracer.formatTrace());
            } else {
                throw err;
            }
        }
    }

    private async doProcess(input: string, type: string): Promise<void> {
        switch (type) {
            case 'command':
                return this.execCommand(input);
            case 'narsese-belief':
                return this.addBelief(input);
            case 'narsese-question':
                return this.askQuestion(input);
            case 'nl-explicit':
                return this.handleNL(input.slice(1, -1));
            case 'nl-implicit':
                return this.handleNL(input);
        }
    }

    private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new TimeoutError(`Operation exceeded ${this.timeoutMs}ms`, { timeoutMs: this.timeoutMs }));
            }, this.timeoutMs);

            fn()
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(err => {
                    clearTimeout(timeout);
                    reject(err);
                });
        });
    }

    private async handleNL(text: string) {
        this.tracer.event('nl_start', text.slice(0, 50));
        if (!this.translator) {
            this.renderer.warn('LM not configured — use Narsese syntax');
            return;
        }
        const spinner = this.renderer.spinner('Translating natural language...');
        try {
            const result = await this.translator.translate(text);
            spinner.succeed(`Translated: "${text}"`);

            for (const belief of result.beliefs) {
                this.tracer.event('nl_belief', belief.narsese);
                await this.nar.input(belief.narsese);
                this.renderer.success(`Added: ${belief.narsese}`);
            }

            if (result.beliefs.length > 0) {
                const derived = await this.nar.run(5);
                if (derived > 0) {
                    this.renderer.info(`Derived ${derived} additional belief(s)`);
                }
            }

            if (result.summary) {
                this.renderer.hint(result.summary);
            }
        } catch (err) {
            spinner.fail('Translation failed');
            this.tracer.event('input_error', err instanceof Error ? err.message : String(err));
            this.renderer.error(err instanceof Error ? err.message : String(err));
        }
    }

    private async addBelief(input: string) {
        this.tracer.event('belief_start', input);
        const term = input.trim().replace(/\.$/, '');
        this.tracer.event('belief_parsed', term);
        try {
            await this.nar.input(term);
            this.tracer.event('belief_input_complete', term);
            this.renderer.success(`Added: (${term}).`);
        } catch (err) {
            this.tracer.event('input_error', err instanceof Error ? err.message : String(err));
            this.renderer.error(`Invalid Narsese: ${err}`);
        }
    }

    private async askQuestion(input: string) {
        this.tracer.event('question_start', input);
        const term = input.trim().replace(/\?$/, '');
        this.tracer.event('question_parsed', term);
        this.renderer.reasoning(`Querying: ${term}`);
        await this.nar.question(term);
        this.tracer.event('question_input_complete', term);
        const derived = await this.nar.run(5);
        this.tracer.event('question_inference_complete', `derived=${derived}`);
        if (derived > 0) {
            this.renderer.success(`Derived ${derived} belief(s)`);
            this.showDerivations(term);
        } else {
            this.renderer.warn('No derivation found');
        }
    }

    private async execCommand(input: string) {
        this.tracer.event('command_start', input);
        if (this.commands) {
            await this.commands.handleCommand(input);
        }
    }

    private showDerivations(_term: string) {
        const concepts = this.nar.listConcepts().slice(0, 5);
        this.renderer.table(
            ['Term', 'Priority'],
            concepts.map(c => [c.term.toString(), c.priority.toFixed(3)]),
        );
    }

    getTrace(): string {
        return this.tracer.formatTrace();
    }
}
