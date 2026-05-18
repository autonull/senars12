import type {BotContext, Belief} from '../../BotContext.js';
import type {PipelineStage} from '../Pipeline.js';
import type {Task} from '../../../nar/types/core.js';

export class SeNARSProcessor implements PipelineStage {
    name = 'SeNARSProcessor';
    priority = 6;
    enabled = (ctx: BotContext) => ctx.capabilities.hasSeNARS &&
        (ctx.turn.reasoningTriggered || ctx.turn.classification.primary === 'narsese');

    async execute(ctx: BotContext): Promise<void> {
        const nar = ctx.seNARS!;
        const text = ctx.turn.input.text.trim();
        const classification = ctx.turn.classification;

        switch (classification.primary) {
            case 'narsese':
                if (text.startsWith('!')) {
                    await nar.goal(text.slice(1));
                } else if (text.includes('?')) {
                    await nar.question(text);
                    const derived = await nar.run(5);
                    ctx.turn.reasoningResult = { steps: derived, beliefs: this.toBeliefs(nar.getBeliefs() as Task[]) };
                } else {
                    await nar.believe(text);
                    const derived = await nar.run(3);
                    ctx.turn.reasoningResult = { steps: derived, beliefs: this.toBeliefs(nar.getBeliefs() as Task[]) };
                }
                break;

            case 'goal':
                await nar.goal(text.slice(1));
                break;

            case 'query':
                await nar.question(text);
                const qDerived = await nar.run(5);
                if (qDerived > 0) {
                    ctx.turn.reasoningResult = { steps: qDerived, beliefs: this.toBeliefs(nar.getBeliefs() as Task[]) };
                }
                break;

            default:
                if (ctx.turn.reasoningTriggered) {
                    const narseseInput = this.naturalLanguageToNarsese(text);
                    if (narseseInput) {
                        await nar.believe(narseseInput);
                    }
                    const derived = await nar.run(ctx.config.reasoning.maxStepsPerTrigger);
                    ctx.turn.reasoningResult = { steps: derived, beliefs: this.toBeliefs(nar.getBeliefs() as Task[]) };
                }
                break;
        }
    }

    private toBeliefs(tasks: Task[]): Belief[] {
        return tasks.map(t => ({
            term: t.term.toString(),
            truth: t.truth ? { frequency: t.truth.f, confidence: t.truth.c } : undefined,
        }));
    }

    private naturalLanguageToNarsese(text: string): string | null {
        const isAMatch = text.match(/^([A-Za-z_]+)\s+is\s+a\s+([A-Za-z_]+)/i);
        if (isAMatch) return `(<${isAMatch[1]} --> ${isAMatch[2]}>.)`;

        const hasMatch = text.match(/^([A-Za-z_]+)\s+has\s+([A-Za-z_]+)/i);
        if (hasMatch) return `(<${hasMatch[1]} --> ${hasMatch[2]}>.)`;

        return null;
    }
}