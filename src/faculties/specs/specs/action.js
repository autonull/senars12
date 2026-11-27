/**
 * Action Faculty Specs — planning, execution, and simulation.
 */
import { createFallback } from './utils';
/** Planning Faculty - generates action sequences */
export const planningSpec = {
    name: 'planning',
    description: 'Generates action sequences to achieve goals',
    category: 'planning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    horizon: { type: 'number' },
                    constraints: { type: 'array', items: { type: 'object' } },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            plan: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        action: { type: 'string' },
                        args: { type: 'object' },
                        expectedOutcome: { type: 'object' },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('planning', { plan: [] }, 0.2, 'Planning fallback', 0.2),
    enabled: true,
    priority: 0.9,
    budgetCost: 0.3,
    maxConcurrency: 3,
    timeoutMs: 20000,
};
/** Propose Action Faculty - suggests concrete actions */
export const proposeActionSpec = {
    name: 'propose.action',
    description: 'Proposes concrete executable actions for the current context',
    category: 'action',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    availableActions: { type: 'array', items: { type: 'string' } },
                    maxProposals: { type: 'number' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            actions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        args: { type: 'object' },
                        expectedUtility: { type: 'number' },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('propose.action', { actions: [] }, 0.15, 'Action proposal fallback', 0.15),
    enabled: true,
    priority: 0.85,
    budgetCost: 0.1,
    maxConcurrency: 10,
    timeoutMs: 5000,
};
/** Propose Plan Faculty - suggests plans */
export const proposePlanSpec = {
    name: 'propose.plan',
    description: 'Proposes structured plans for goal achievement',
    category: 'planning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    goal: { type: 'object' },
                    constraints: { type: 'array', items: { type: 'object' } },
                    maxSteps: { type: 'number' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            plans: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        steps: { type: 'array', items: { type: 'object' } },
                        estimatedCost: { type: 'number' },
                        successProbability: { type: 'number' },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('propose.plan', { plans: [] }, 0.15, 'Plan proposal fallback', 0.15),
    enabled: true,
    priority: 0.7,
    budgetCost: 0.25,
    maxConcurrency: 4,
    timeoutMs: 15000,
};
/** Simulate Scenario Faculty - runs simulations */
export const simulateScenarioSpec = {
    name: 'simulate.scenario',
    description: 'Simulates scenarios to predict outcomes',
    category: 'planning',
    inputSchema: {
        type: 'object',
        properties: {
            primary: { type: 'object' },
            context: {
                type: 'object',
                properties: {
                    scenarioType: { type: 'string' },
                    iterations: { type: 'number' },
                    variables: { type: 'object' },
                },
            },
        },
        required: ['primary'],
    },
    outputSchema: {
        type: 'object',
        properties: {
            scenarios: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        outcome: { type: 'object' },
                        probability: { type: 'number' },
                        trace: { type: 'array', items: { type: 'object' } },
                    },
                },
            },
        },
    },
    oracleOperation: 'lm.generateObject',
    fallback: createFallback('simulate.scenario', { scenarios: [] }, 0.05, 'Simulation fallback', 0.05),
    enabled: true,
    priority: 0.5,
    budgetCost: 0.5,
    maxConcurrency: 2,
    timeoutMs: 60000,
};
