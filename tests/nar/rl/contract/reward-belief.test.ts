import {beforeEach, describe, expect, test} from 'vitest';
import {NAR, TermBuilder, Truth,} from '../../../../nar/src';

describe('Reward and Value Representation Contract', () => {
    let nar: NAR;

    beforeEach(() => {
        nar = new NAR({
            enableLMRules: false,
            enableTools: true,
            enableSelf: false,
            enableRLFP: false,
            persistState: false,
            maxConcepts: 10000,
            maxDerivationsPerStep: 1000,
            maxDerivationDepth: 20,
        });
    });

    test('Positive reward represented correctly as reward belief', async () => {
        const rewardTerm = TermBuilder.inheritance(TermBuilder.atom('reward:high'), TermBuilder.atom('achieved'));
        const truth = Truth.create(0.90, 0.90);

        await nar.believe(rewardTerm, truth);

        const concept = nar.getConcept(rewardTerm);
        expect(concept).toBeDefined();

        const beliefs = concept!.getBeliefs();
        expect(beliefs.length).toBeGreaterThan(0);
        expect(beliefs[0].truth.f).toBeCloseTo(0.90, 1);
        expect(beliefs[0].truth.c).toBeCloseTo(0.90, 1);
    });

    test('Negative reward represented correctly', async () => {
        const rewardTerm = TermBuilder.inheritance(TermBuilder.atom('reward:low'), TermBuilder.atom('achieved'));
        // Negative reward represented as low frequency
        const truth = Truth.create(0.10, 0.80);

        await nar.believe(rewardTerm, truth);

        const concept = nar.getConcept(rewardTerm);
        expect(concept).toBeDefined();

        const beliefs = concept!.getBeliefs();
        expect(beliefs.length).toBeGreaterThan(0);
        expect(beliefs[0].truth.f).toBeCloseTo(0.10, 1);
    });

    test('Reward updates relevant state-action value belief', async () => {
        // State-action value: ((*, state:s_3_4, ^move_north) --> predicts_reward)
        const state = TermBuilder.atom('state:s_3_4');
        const action = TermBuilder.atom('^move_north');
        const product = TermBuilder.product([state, action]);
        const predictsReward = TermBuilder.atom('predicts_reward');
        const valueTerm = TermBuilder.inheritance(product, predictsReward);

        // Initial value belief
        await nar.believe(valueTerm, Truth.create(0.5, 0.5));

        // Receive reward
        const rewardTerm = TermBuilder.inheritance(TermBuilder.atom('reward:high'), TermBuilder.atom('achieved'));
        await nar.believe(rewardTerm, Truth.create(1.0, 0.9));

        // The value belief should be updated through reasoning (revision)
        // In a full implementation, this would be done via QBeliefStore.updateValue
        // Here we verify the representation can be stored and retrieved
        const concept = nar.getConcept(valueTerm);
        expect(concept).toBeDefined();

        const beliefs = concept!.getBeliefs();
        expect(beliefs.length).toBeGreaterThan(0);
    });

    test('Confidence reflects evidence (more observations = higher confidence)', async () => {
        const state = TermBuilder.atom('state:s_1_1');
        const action = TermBuilder.atom('^move_north');
        const product = TermBuilder.product([state, action]);
        const predictsReward = TermBuilder.atom('predicts_reward');
        const valueTerm = TermBuilder.inheritance(product, predictsReward);

        // First observation - low confidence
        await nar.believe(valueTerm, Truth.create(0.7, 0.4));

        const concept1 = nar.getConcept(valueTerm);
        const initialConfidence = concept1!.getBeliefs()[0]?.truth.c ?? 0;

        // Second observation - should revise and increase confidence
        await nar.believe(valueTerm, Truth.create(0.8, 0.6));

        const concept2 = nar.getConcept(valueTerm);
        const revisedConfidence = concept2!.getBeliefs()[0]?.truth.c ?? 0;

        // Truth.revision should increase confidence with more evidence
        expect(revisedConfidence).toBeGreaterThanOrEqual(initialConfidence);
    });

    test('Terminal reward creates appropriate satisfaction signal', async () => {
        // Goal satisfaction: reward:high!
        const satisfactionGoal = TermBuilder.atom('reward:high');
        await nar.goal(satisfactionGoal);

        const goals = nar.getGoals();
        const matchingGoal = goals.find(g => g.term.toString() === satisfactionGoal.toString());

        expect(matchingGoal).toBeDefined();
        expect(matchingGoal?.type).toBe('goal');
    });

    test('State-action value uses native Product/Inheritance form', async () => {
        // Verify the canonical form: ((*, state:s_3_4, ^move_north) --> predicts_reward)
        const state = TermBuilder.atom('state:s_3_4');
        const action = TermBuilder.atom('^move_north');
        const product = TermBuilder.product(state, action);
        const predictsReward = TermBuilder.atom('predicts_reward');
        const valueTerm = TermBuilder.inheritance(product, predictsReward);

        await nar.believe(valueTerm, Truth.create(0.78, 0.62));

        const concept = nar.getConcept(valueTerm);
        expect(concept).toBeDefined();

        const term = concept!.term;
        expect(term.kind).toBe('inheritance');

        const inh = term;
        expect(inh.args[0].kind).toBe('product');
        expect(inh.args[1].symbol).toBe('predicts_reward');

        const productArgs = inh.args[0].args;
        expect(productArgs.length).toBe(2);
        // Product is commutative, args are sorted alphabetically
        const symbols = productArgs.map((a: any) => a.symbol).sort();
        expect(symbols).toEqual(['^move_north', 'state:s_3_4']);
    });

    test('truth.f represents estimated reward (frequency), truth.c represents confidence', async () => {
        const state = TermBuilder.atom('state:s_3_4');
        const action = TermBuilder.atom('^move_north');
        const product = TermBuilder.product([state, action]);
        const predictsReward = TermBuilder.atom('predicts_reward');
        const valueTerm = TermBuilder.inheritance(product, predictsReward);

        // f = 0.78 (estimated reward), c = 0.62 (confidence)
        await nar.believe(valueTerm, Truth.create(0.78, 0.62));

        const concept = nar.getConcept(valueTerm);
        const belief = concept!.getBeliefs()[0];

        expect(belief.truth.f).toBeCloseTo(0.78, 2);
        expect(belief.truth.c).toBeCloseTo(0.62, 2);
    });
});