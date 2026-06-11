import {describe, it, expect, beforeEach} from '@jest/globals';
import {MetaCritic} from '../../../src/agent/MetaCritic.js';
import {AgentEventBus} from '../../../src/agent/AgentEventBus.js';
import type {Goal} from '../../../src/agent/GoalManager.js';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
    const now = Date.now();
    return {
        id: 'test-goal-1',
        description: 'understand feline behavior',
        status: 'active',
        subgoals: [],
        progress: 0.3,
        createdAt: now,
        updatedAt: now,
        priority: 5,
        ...overrides,
    };
}

describe('MetaCritic', () => {
    let eventBus: AgentEventBus;

    beforeEach(() => {
        eventBus = new AgentEventBus();
    });

    it('getLastScore returns undefined initially', () => {
        const mc = new MetaCritic({eventBus});
        expect(mc.getLastScore()).toBeUndefined();
    });

    it('evaluate returns default score when no goal', () => {
        const mc = new MetaCritic({eventBus});
        const result = mc.evaluate(undefined, {});
        expect(result.score).toBe(0.5);
        expect(result.recommendations).toEqual([]);
        expect(result.goalId).toBeUndefined();
    });

    it('evaluate returns score based on goal progress', () => {
        const mc = new MetaCritic({eventBus});
        const goal = makeGoal({progress: 0.8});
        const result = mc.evaluate(goal, {});
        expect(result.score).toBeGreaterThan(0.3);
        expect(result.goalId).toBe('test-goal-1');
    });

    it('evaluate recommends subgoals when progress low', () => {
        const mc = new MetaCritic({eventBus});
        const goal = makeGoal({progress: 0});
        const result = mc.evaluate(goal, {});
        expect(result.recommendations.some(r => r.toLowerCase().includes('subgoal'))).toBe(true);
    });

    it('evaluate recommends gathering info when no goal-relevant WM', () => {
        const mc = new MetaCritic({eventBus});
        const goal = makeGoal();
        const result = mc.evaluate(goal, {unrelated: 'data'});
        const lacksWM = result.recommendations.some(r =>
            r.toLowerCase().includes('working memory') && r.toLowerCase().includes('goal-relevant')
        );
        expect(lacksWM).toBe(true);
    });

    it('evaluate detects relevant working memory', () => {
        const mc = new MetaCritic({eventBus});
        const goal = makeGoal();
        const result = mc.evaluate(goal, {focus: 'feline behavior study'});
        const hasWM = result.recommendations.every(r =>
            !r.toLowerCase().includes('working memory') || !r.toLowerCase().includes('goal-relevant')
        );
        expect(hasWM).toBe(true);
    });

    it('evaluate persists last score', () => {
        const mc = new MetaCritic({eventBus});
        mc.evaluate(undefined, {});
        expect(mc.getLastScore()).toBe(0.5);
    });

    it('tick emits agent:meta:evaluation event', () => {
        const events: Array<{score: number; recommendations: string[]}> = [];
        eventBus.on('agent:meta:evaluation', (p) => {
            events.push({score: p.score, recommendations: p.recommendations});
        });
        const mc = new MetaCritic({eventBus});
        mc.tick(undefined, {});
        expect(events).toHaveLength(1);
        expect(events[0]!.score).toBe(0.5);
    });

    it('tick with goal includes goalId in event', () => {
        let capturedGoalId: string | undefined;
        eventBus.on('agent:meta:evaluation', (p) => { capturedGoalId = p.goalId; });
        const mc = new MetaCritic({eventBus});
        const goal = makeGoal();
        mc.tick(goal, {});
        expect(capturedGoalId).toBe('test-goal-1');
    });
});
