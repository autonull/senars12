/**
 * SeNARS Demo Scenarios
 * End-to-end demonstration scripts
 */

import {NAR, SeNARSFactory} from '../nar';
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

export const knowledgeBaseDemo: DemoScenario = {
    name: 'Knowledge Base Reasoning',
    description: 'Load facts and query conclusions',
    run: async (nar: NAR) => {
        console.log('Loading knowledge base...\n');

        await nar.input('(cat --> animal).');
        console.log('✓ Added: (cat --> animal)');

        await nar.input('(dog --> animal).');
        console.log('✓ Added: (dog --> animal)');

        await nar.input('(animal --> living-being).');
        console.log('✓ Added: (animal --> living-being)');

        console.log('\nRunning inference...\n');
        const derived = await nar.run(10);
        console.log(`Derived ${derived} new belief(s)`);

        console.log('\nQuerying memory...\n');
        const concepts = nar.listConcepts();
        console.log(`Memory contains ${concepts.length} concept(s):`);
        for (const concept of concepts.slice(0, 10)) {
            console.log(`  - ${concept.term.toString()}`);
        }
    }
};

export const goalAchievementDemo: DemoScenario = {
    name: 'Goal Achievement',
    description: 'Set goal and watch decomposition',
    run: async (nar: NAR) => {
        console.log('Setting up goals and beliefs...\n');

        await nar.input('(want --> eat-food).!');
        console.log('✓ Goal: (want --> eat-food)');

        await nar.input('(eat-food --> action).');
        console.log('✓ Belief: (eat-food --> action)');

        await nar.input('(action --> do).');
        console.log('✓ Belief: (action --> do)');

        console.log('\nRunning goal-directed reasoning...\n');
        const derived = await nar.run(5);
        console.log(`Derived ${derived} belief(s)`);

        const goals = nar.getGoals();
        console.log(`\nActive goals: ${goals.length}`);
        for (const goal of goals.slice(0, 5)) {
            console.log(`  - ${goal.term.toString()}`);
        }
    }
};

export const analogicalReasoningDemo: DemoScenario = {
    name: 'Analogical Reasoning',
    description: 'Cross-domain transfer',
    run: async (nar: NAR) => {
        console.log('Setting up analogical domains...\n');

        await nar.input('(bird --> fly).');
        console.log('✓ Source: (bird --> fly)');

        await nar.input('(fish --> swim).');
        console.log('✓ Source: (fish --> swim)');

        await nar.input('(bird --> animal).');
        console.log('✓ Source: (bird --> animal)');

        await nar.input('(fish --> animal).');
        console.log('✓ Source: (fish --> animal)');

        console.log('\nRunning analogical inference...\n');
        const derived = await nar.run(10);
        console.log(`Derived ${derived} belief(s)`);

        const concepts = nar.listConcepts();
        console.log(`\nConcepts after analogy: ${concepts.length}`);
    }
};

export const questionAnsweringDemo: DemoScenario = {
    name: 'Question Answering',
    description: 'Answer questions from knowledge base',
    run: async (nar: NAR) => {
        console.log('Building knowledge base...\n');

        await nar.input('(Paris --> capital-of-France).');
        console.log('✓ Added: (Paris --> capital-of-France)');

        await nar.input('(France --> country).');
        console.log('✓ Added: (France --> country)');

        console.log('\nAsking questions...\n');
        await nar.input('(Paris --> ?)?');
        console.log('✓ Asked: (Paris --> ?)');

        const derived = await nar.run(5);
        console.log(`\nDerived ${derived} belief(s)`);

        const questions = nar.getQuestions();
        console.log(`\nActive questions: ${questions.length}`);
    }
};

export const basicInferenceDemo: DemoScenario = {
    name: 'Basic Inference',
    description: 'Simple syllogistic reasoning',
    run: async (nar: NAR) => {
        console.log('Setting up syllogism...\n');

        await nar.input('(Socrates --> human).');
        console.log('✓ Premise: (Socrates --> human)');

        await nar.input('(human --> mortal).');
        console.log('✓ Premise: (human --> mortal)');

        console.log('\nRunning deduction...\n');
        const derived = await nar.run(5);
        console.log(`Derived ${derived} new belief(s)`);

        const concepts = nar.listConcepts();
        console.log(`\nConcepts: ${concepts.length}`);
        for (const concept of concepts) {
            console.log(`  - ${concept.term.toString()}`);
        }
    }
};

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
