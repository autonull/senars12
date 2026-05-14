import {describe, expect, test} from '@jest/globals';
import {Memory} from '../../../src/nar';
import {QueryAPI, ReasoningTrace} from '../../../src/nar/query';
import type {Tool} from '../../../src/nar/tools';
import {ToolManager} from '../../../src/nar/tools';
import type {RuleStats} from '../../../src/nar/metrics';
import {MetricsCollector} from '../../../src/nar/metrics';
import {createBudget, createTask} from '../../../src/nar';
import {TermBuilder, Truth} from '../../../src/nar';

const createMockTool = (name: string, executeFn?: (args: Record<string, unknown>) => Promise<any>): Tool => ({
    name,
    description: `Test tool ${name}`,
    parameters: {type: 'object', properties: {}},
    capabilities: {pure: true, readOnly: true},
    execute: executeFn ?? (async () => ({success: true, content: 'result'}))
});

describe('NAR Query and Metrics', () => {
    let memory: Memory;
    let query: QueryAPI;
    let traceAPI: ReasoningTrace;
    let tools: ToolManager;
    let metrics: MetricsCollector;

    beforeEach(() => {
        memory = new Memory({
            maxConcepts: 100,
            priorityThreshold: 0.5,
            activationDecayRate: 0.01,
            consolidationInterval: 10
        });
        query = new QueryAPI(memory);
        traceAPI = new ReasoningTrace(memory);
        tools = new ToolManager();
        metrics = new MetricsCollector();
    });

    describe('Query API', () => {
        test('getBeliefs returns beliefs', () => {
            memory.addTask(TermBuilder.atom('A'), 'belief', Truth.TRUE, createBudget(0.9));
            memory.addTask(TermBuilder.atom('B'), 'belief', Truth.FALSE, createBudget(0.7));

            const beliefs = query.getBeliefs();

            expect(beliefs.length).toBeGreaterThan(0);
        });

        test('getBeliefs returns empty array when no beliefs', () => {
            const beliefs = query.getBeliefs();
            expect(beliefs).toEqual([]);
        });

        test('getGoals returns goal tasks', () => {
            memory.addTask(TermBuilder.atom('goal1'), 'goal', Truth.TRUE, createBudget(0.8));

            const goals = query.getGoals();

            expect(goals.length).toBeGreaterThan(0);
        });

        test('getQuestions returns question tasks', () => {
            memory.addTask(TermBuilder.atom('question1'), 'question', Truth.NEUTRAL, createBudget(0.6));

            const questions = query.getQuestions();

            expect(questions.length).toBeGreaterThan(0);
        });

        test('query returns result for term', () => {
            memory.addTask(TermBuilder.atom('querytest'), 'belief', Truth.TRUE, createBudget(0.8));

            const result = query.query(TermBuilder.atom('querytest'));

            expect(result).toBeDefined();
        });
    });

    describe('ReasoningTrace', () => {
        test('getDerivationHistory returns history', () => {
            const task = createTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.8));

            const history = traceAPI.getDerivationHistory(task);

            expect(history).toBeDefined();
            expect(Array.isArray(history)).toBe(true);
        });
    });

    describe('ToolManager', () => {
        test('executes registered tool', async () => {
            const mockTool = createMockTool('test-tool');
            tools.register(mockTool);
            await tools.initializeTool('test-tool');

            const result = await tools.execute('test-tool', {});

            expect(result.success).toBe(true);
        });

        test('returns error for non-existent tool', async () => {
            const result = await tools.execute('non-existent', {});

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        test('returns list of tools', () => {
            const mockTool = createMockTool('tool1');
            tools.register(mockTool);

            const toolsList = tools.list();

            expect(toolsList.length).toBeGreaterThan(0);
        });
    });

    describe('MetricsCollector', () => {
        test('returns metrics summary', () => {
            const summary = metrics.getSummary();

            expect(summary).toBeDefined();
            expect(summary.system).toBeDefined();
            expect(summary.rules).toBeDefined();
        });

        test('records rule execution', () => {
            metrics.recordRuleExecution('test-rule', true, 10);

            const stats = metrics.getRuleStats('test-rule') as RuleStats | null;
            expect(stats).toBeDefined();
            expect(stats!.executions).toBe(1);
            expect(stats!.successes).toBe(1);
        });

        test('records failed execution', () => {
            metrics.recordRuleExecution('fail-rule', false, 5);

            const stats = metrics.getRuleStats('fail-rule') as RuleStats | null;
            expect(stats!.failures).toBe(1);
        });

        test('increments derivation count', () => {
            metrics.incrementDerivations(5);
            const summary = metrics.getSummary();
            expect(summary.system.totalDerivations).toBe(5);
        });

        test('increments step count', () => {
            metrics.incrementSteps(3);
            const summary = metrics.getSummary();
            expect(summary.system.totalSteps).toBe(3);
        });
    });
});
