/**
 * SeNARS Demo Scenarios
 * End-to-end demonstration scripts
 */

import type {NAR} from '../nar';
import {SeNARSFactory} from '../nar';
import {errMsg} from '../nar/utils/helpers.js';

export interface DemoScenario {
    name: string;
    description: string;
    run: (nar: NAR) => Promise<void>;
}

export class DemoRunner {
    private readonly nar: NAR;

    constructor(nar?: NAR) {
        this.nar = nar || SeNARSFactory.createDefault();
    }

    async runScenario(scenario: DemoScenario): Promise<void> {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Demo: ${scenario.name}`);
        console.log(`${'='.repeat(60)}\n`);

        try {
            await scenario.run(this.nar);
            console.log('\n✓ Demo completed successfully\n');
        } catch (error) {
            console.error(`\n✗ Demo failed: ${errMsg(error)}\n`);
            throw error;
        }
    }

    async runAllScenarios(scenarios: DemoScenario[]): Promise<void> {
        for (const scenario of scenarios) {
            await this.runScenario(scenario);
            this.nar.clearMemory();
        }
    }
}

interface DemoInput { text: string; label?: string }

const demo = (name: string, description: string, inputs: DemoInput[], runSteps = 5, showConcepts = false): DemoScenario => ({
    name, description,
    run: async (nar) => {
        for (const {text, label} of inputs) {
            await nar.input(text);
            console.log(`✓ ${label ?? 'Added'}: ${text}`);
        }
        const derived = await nar.run(runSteps);
        console.log(`Derived ${derived} belief(s)`);
        if (showConcepts) {
            const concepts = nar.listConcepts();
            console.log(`Concepts: ${concepts.length}`);
            for (const c of concepts.slice(0, 10)) console.log(`  - ${c.term.toString()}`);
        }
    }
});

export const knowledgeBaseDemo: DemoScenario = demo('Knowledge Base Reasoning', 'Load facts and query conclusions', [
    {text: '(cat --> animal).'}, {text: '(dog --> animal).'}, {text: '(animal --> living-being).'},
], 10, true);

export const goalAchievementDemo: DemoScenario = demo('Goal Achievement', 'Set goal and watch decomposition', [
    {text: '(want --> eat-food).!', label: 'Goal'}, {text: '(eat-food --> action).'}, {text: '(action --> do).'},
], 5);

export const analogicalReasoningDemo: DemoScenario = demo('Analogical Reasoning', 'Cross-domain transfer', [
    {text: '(bird --> fly).'}, {text: '(fish --> swim).'}, {text: '(bird --> animal).'}, {text: '(fish --> animal).'},
], 10);

export const questionAnsweringDemo: DemoScenario = demo('Question Answering', 'Answer questions from knowledge base', [
    {text: '(Paris --> capital-of-France).'}, {text: '(France --> country).'}, {text: '(Paris --> ?)?', label: 'Asked'},
], 5);

export const basicInferenceDemo: DemoScenario = demo('Basic Inference', 'Simple syllogistic reasoning', [
    {text: '(Socrates --> human).', label: 'Premise'}, {text: '(human --> mortal).', label: 'Premise'},
], 5, true);

export const demos: DemoScenario[] = [
    basicInferenceDemo,
    knowledgeBaseDemo,
    goalAchievementDemo,
    analogicalReasoningDemo,
    questionAnsweringDemo
];

export async function runAllDemos(): Promise<void> {
    const runner = new DemoRunner();
    await runner.runAllScenarios(demos);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runAllDemos().catch(console.error);
}
