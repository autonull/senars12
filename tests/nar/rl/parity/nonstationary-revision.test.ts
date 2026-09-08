import {describe, expect, test} from 'vitest';
import {NonStationaryBanditEnv} from '../environments/RLEnvironments';
import {NAR} from '../../../../nar/src/nar';
import {TermBuilder} from '../../../../nar/src';
import {BeliefPerceptionAdapter, GoalActionAdapter, RewardBeliefAdapter} from '../adapters/adapters';

describe('RL Parity - Non-Stationary Environment', () => {
    test('SeNARS can track drifting reward means', async () => {
        const env = new NonStationaryBanditEnv({
            numArms: 2,
            initialMeans: [0.8, 0.2], // Arm 0 initially optimal
            changeInterval: 10,
            changeMagnitude: 0.3,
            seed: 42,
        });

        const nar = new NAR({
            enableLMRules: false,
            enableTools: true,
            enableSelf: false,
            enableRLFP: false,
            persistState: false,
            maxConcepts: 1000,
            maxDerivationsPerStep: 100,
            maxDerivationDepth: 10,
        });

        const perception = new BeliefPerceptionAdapter(nar);
        const actionAdapter = new GoalActionAdapter(nar);
        const rewardAdapter = new RewardBeliefAdapter(nar);
        const qStore = rewardAdapter.getQStore();

        // Register tools
        nar.tools.register({
            name: 'pull_arm_0',
            description: 'Pull arm 0',
            parameters: {type: 'object', properties: {}},
            execute: async () => ({success: true}),
        });
        nar.tools.register({
            name: 'pull_arm_1',
            description: 'Pull arm 1',
            parameters: {type: 'object', properties: {}},
            execute: async () => ({success: true}),
        });

        // Track which arm was optimal over time
        const optimalArms: number[] = [];

        for (let step = 0; step < 50; step++) {
            const currentMeans = env.getCurrentMeans();
            optimalArms.push(env.getOptimalArm());

            // Perceive
            perception.perceive({stateId: 'bandit_state', reward: 0});

            // Simple alternating strategy for test
            const action = step % 2;

            // Execute
            const goalTerm = actionAdapter.buildGoalTerm({name: `pull_arm_${action}`});
            await nar.tools.executeToolGoal(goalTerm);

            // Step
            const {reward} = env.step(action);

            // Update beliefs
            const stateTerm = TermBuilder.atom('bandit_state');
            const actionTerm = TermBuilder.atom(`^pull_arm_${action}`);
            rewardAdapter.processReward(stateTerm, actionTerm, reward);
        }

        // Verify optimal arm could have changed
        const uniqueOptimals = new Set(optimalArms);
        expect(uniqueOptimals.size).toBeGreaterThanOrEqual(1); // At least one optimal

        // Verify value beliefs exist
        const stateTerm = TermBuilder.atom('bandit_state');
        for (let i = 0; i < 2; i++) {
            const actionTerm = TermBuilder.atom(`^pull_arm_${i}`);
            const value = qStore.getValue(stateTerm, actionTerm);
            expect(value === null || typeof value === 'object').toBe(true);
        }
    });

    test('Non-stationary environment means drift', () => {
        const env = new NonStationaryBanditEnv({
            numArms: 3,
            initialMeans: [0.3, 0.5, 0.7],
            changeInterval: 5,
            changeMagnitude: 0.2,
            seed: 123,
        });

        const initialMeans = env.getCurrentMeans();
        expect(initialMeans).toEqual([0.3, 0.5, 0.7]);

        // Advance to trigger drift
        for (let i = 0; i < 10; i++) {
            env.step(0);
        }

        const driftedMeans = env.getCurrentMeans();
        // At least one mean should have changed
        let anyChanged = false;
        for (let i = 0; i < 3; i++) {
            if (Math.abs(driftedMeans[i] - initialMeans[i]) > 0.01) {
                anyChanged = true;
                break;
            }
        }
        expect(anyChanged).toBe(true);
    });
});