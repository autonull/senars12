import {classify} from '../nar/nl/classifier.js';
import type {NLTranslator} from '../nar/nl/translator.js';
import type {NAR} from '../nar/nar.js';
import type {OutputRenderer} from './display.js';
import type {CommandHandlers} from './command-handlers.js';

export class InputPipeline {
    constructor(
        private nar: NAR,
        private translator: NLTranslator | undefined,
        private renderer: OutputRenderer,
        private commands?: CommandHandlers,
    ) {}

    async process(input: string): Promise<void> {
        const type = classify(input);
        switch (type) {
            case 'command':        return this.execCommand(input);
            case 'narsese-belief': return this.addBelief(input);
            case 'narsese-question': return this.askQuestion(input);
            case 'nl-explicit':    return this.handleNL(input.slice(1, -1));
            case 'nl-implicit':    return this.handleNL(input);
        }
    }

    private async handleNL(text: string) {
        if (!this.translator) {
            this.renderer.warn('LM not configured — use Narsese syntax');
            return;
        }
        const spinner = this.renderer.spinner('Translating natural language...');
        try {
            const result = await this.translator.translate(text);
            spinner.succeed(`Translated: "${text}"`);

            for (const belief of result.beliefs) {
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
            this.renderer.error(err instanceof Error ? err.message : String(err));
        }
    }

    private async addBelief(input: string) {
        const term = input.trim().replace(/\.$/, '');
        try {
            await this.nar.input(term);
            this.renderer.success(`Added: (${term}).`);
        } catch (err) {
            this.renderer.error(`Invalid Narsese: ${err}`);
        }
    }

    private async askQuestion(input: string) {
        const term = input.trim().replace(/\?$/, '');
        this.renderer.reasoning(`Querying: ${term}`);
        await this.nar.question(term);
        const derived = await this.nar.run(5);
        if (derived > 0) {
            this.renderer.success(`Derived ${derived} belief(s)`);
            this.showDerivations(term);
        } else {
            this.renderer.warn('No derivation found');
        }
    }

    private async execCommand(input: string) {
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
}
