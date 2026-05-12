import {describe, expect, test} from '@jest/globals';
import {NARFacade} from '../../nar-facade';
import {Memory} from '../../memory';
import {QueryAPI} from '../../query';
import {Reasoner} from '../../reason';
import {BagStrategy} from '../../reason';
import {ToolManager} from '../../tools';
import type {RuleStats} from '../../metrics';
import {MetricsCollector} from '../../metrics';
import {createBudget, createTask} from '../../types';
import {atom, TermBuilder, Truth} from '../../terms';
import type {Tool} from '../../tools';

const createMockTool = (name: string, executeFn?: (args: Record<string, unknown>) => Promise<any>): Tool => ({
    name,
    description: `Test tool ${name}`,
    parameters: {type: 'object', properties: {}},
    capabilities: {pure: true, readOnly: true},
    execute: executeFn ?? (async () => ({success: true, content: 'result'}))
});

describe('NARFacade', () => {
    let memory: Memory;
    let query: QueryAPI;
    let _reasoner: Reasoner;
    let tools: ToolManager;
    let metrics: MetricsCollector;
    let facade: NARFacade;

    beforeEach(() => {
        memory = new Memory({
            maxConcepts: 100,
            priorityThreshold: 0.5,
            activationDecayRate: 0.01,
            consolidationInterval: 10
        });
        query = new QueryAPI(memory);
        _reasoner = new Reasoner(
            memory,
            {processSync: () => []} as any,
            BagStrategy,
            {cpuThrottleMs: 0, maxDerivationDepth: 10, maxDerivationsPerStep: 100}
        );
        tools = new ToolManager();
        metrics = new MetricsCollector();
        facade = new NARFacade(memory, query, {
            getDerivationHistory: () => [],
            trace: () => null,
            explain: () => null
        } as any, tools, metrics);
    });

    describe('getBeliefs', () => {
        test('returns beliefs filtered', () => {
            memory.addTask(TermBuilder.atom('A'), 'belief', Truth.TRUE, createBudget(0.9));
            memory.addTask(TermBuilder.atom('B'), 'belief', Truth.FALSE, createBudget(0.7));

            const beliefs = facade.getBeliefs();

            expect(beliefs.length).toBeGreaterThan(0);
        });

        test('returns empty array when no beliefs', () => {
            const beliefs = facade.getBeliefs();
            expect(beliefs).toEqual([]);
        });
    });

    describe('getGoals', () => {
        test('returns goal tasks', () => {
            memory.addTask(TermBuilder.atom('goal1'), 'goal', Truth.TRUE, createBudget(0.8));

            const goals = facade.getGoals();

            expect(goals.length).toBeGreaterThan(0);
        });
    });

    describe('getQuestions', () => {
        test('returns question tasks', () => {
            memory.addTask(TermBuilder.atom('question1'), 'question', Truth.NEUTRAL, createBudget(0.6));

            const questions = facade.getQuestions();

            expect(questions.length).toBeGreaterThan(0);
        });
    });

    describe('ask', () => {
        test('returns typed Ask result', async () => {
            memory.addTask(TermBuilder.atom('test'), 'belief', Truth.create(0.9, 0.9), createBudget(0.9));

            const result = await facade.ask('test');

            expect(result).toBeDefined();
            expect(result.question).toBe('test');
            expect(typeof result.confidence).toBe('number');
        });

        test('returns answer with evidence when term exists in memory', async () => {
            const termA = TermBuilder.atom('A');
            memory.addTask(termA, 'belief', Truth.create(0.95, 0.95), createBudget(0.9));

            const result = await facade.ask(termA);

            expect(result.confidence).toBeGreaterThan(0);
        });
    });

    describe('executeTool', () => {
        test('executes registered tool', async () => {
            const mockTool = createMockTool('test-tool');
            tools.register(mockTool);
            await tools.initializeTool('test-tool');

            const result = await facade.executeTool('test-tool', {});

            expect(result.success).toBe(true);
        });

        test('returns error for non-existent tool', async () => {
            const result = await facade.executeTool('non-existent', {});

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    describe('listTools', () => {
        test('returns list of tools', () => {
            const mockTool = createMockTool('tool1');
            tools.register(mockTool);

            const toolsList = facade.listTools();

            expect(toolsList.length).toBeGreaterThan(0);
        });
    });

    describe('getMetrics', () => {
        test('returns metrics summary', () => {
            const summary = facade.getMetrics();

            expect(summary).toBeDefined();
            expect(summary.system).toBeDefined();
            expect(summary.rules).toBeDefined();
        });
    });

    describe('recordRuleExecution', () => {
        test('records rule execution in metrics', () => {
            facade.recordRuleExecution('test-rule', true, 10);

            const stats = metrics.getRuleStats('test-rule') as RuleStats | null;
            expect(stats).toBeDefined();
            expect(stats!.executions).toBe(1);
            expect(stats!.successes).toBe(1);
        });

        test('records failed execution', () => {
            facade.recordRuleExecution('fail-rule', false, 5);

            const stats = metrics.getRuleStats('fail-rule') as RuleStats | null;
            expect(stats!.failures).toBe(1);
        });
    });

    describe('incrementDerivations', () => {
        test('increments derivation count', () => {
            facade.incrementDerivations(5);
            const summary = facade.getMetrics();
            expect(summary.system.totalDerivations).toBe(5);
        });
    });

    describe('incrementSteps', () => {
        test('increments step count', () => {
            facade.incrementSteps(3);
            const summary = facade.getMetrics();
            expect(summary.system.totalSteps).toBe(3);
        });
    });

    describe('queryTerm', () => {
        test('queries term and returns result', () => {
            memory.addTask(TermBuilder.atom('querytest'), 'belief', Truth.TRUE, createBudget(0.8));

            const result = facade.queryTerm(atom('querytest'));

            expect(result).toBeDefined();
        });
    });

    describe('getDerivationHistory', () => {
        test('returns derivation history for task', () => {
            const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.8));

            const history = facade.getDerivationHistory(task);

            expect(history).toBeDefined();
        });
    });

    describe('traceTerm', () => {
        test('traces term', () => {
            memory.addTask(TermBuilder.atom('trace'), 'belief', Truth.TRUE, createBudget(0.8));

            const trace = facade.traceTerm(atom('trace'));

            expect(trace).toBeDefined();
        });
    });
});