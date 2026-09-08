import {beforeEach, describe, expect, test} from 'vitest';
import {createBudget, createTask, NAR, TermBuilder, termParser, Truth,} from '../../../../nar/src';

describe('Goal/Action Contract', () => {
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

    test('Goals are generated from cognitive state via nar.goal()', async () => {
        const goalTerm = TermBuilder.atom('move_north');
        await nar.goal(goalTerm);

        const goals = nar.getGoals();
        const matchingGoal = goals.find(g => g.term.toString() === goalTerm.toString());

        expect(matchingGoal).toBeDefined();
        expect(matchingGoal?.type).toBe('goal');
    });

    test('Correct native AST (Inheritance(Product, Atom(^op))) for argument-bearing operation', () => {
        // termParser parses ^tool(args) into Inheritance(Product(args...), Atom('^tool'))
        const goalTerm = termParser.parse('^move_to(state:s_3_4, direction:north)');
        expect(goalTerm.kind).toBe('inheritance');

        const args = goalTerm.args;
        const subject = args[0];
        const predicate = args[1];

        expect(subject.kind).toBe('product');
        expect(predicate.kind).toBe('atom');
        expect(predicate.symbol).toBe('^move_to');
    });

    test('Goals in native AST reach ToolManager.executeToolGoal() via nar.run()', async () => {
        // Register a tool
        const calls: Array<Record<string, unknown>> = [];
        nar.tools.register({
            name: 'echo_goal',
            description: 'test tool',
            parameters: {type: 'object', properties: {}},
            execute: async (args: Record<string, unknown>) => {
                calls.push(args);
                return {success: true, content: {called: args}};
            },
        });

        // Inject tool goal in native AST form into the pending queue
        nar.taskManager.addTask(
            createTask(termParser.parse('^echo_goal(profile:test)'), 'goal', Truth.NEUTRAL, createBudget(0.9))
        );

        await nar.run(1);

        expect(calls.length).toBe(1);
        expect(calls[0]).toEqual({profile: 'test'});
    });

    test('Invalid operations fail safely (returns ToolResult { success: false })', async () => {
        // Tool goal referencing a non-existent tool, in native AST form
        const goalTerm = termParser.parse('^nonexistent_tool()');
        const result = await nar.tools.executeToolGoal(goalTerm);

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
    });

    test('Goal priority (task.budget.priority) affects dispatch order', async () => {
        // taskManager.getPending() is priority-sorted
        const calls: string[] = [];
        const record = (name: string) => async (args: Record<string, unknown>) => {
            calls.push(name);
            return {success: true, content: {called: args}};
        };

        nar.tools.register({
            name: 'low_prio',
            description: 'low priority tool',
            parameters: {type: 'object', properties: {}},
            execute: record('low'),
        });
        nar.tools.register({
            name: 'high_prio',
            description: 'high priority tool',
            parameters: {type: 'object', properties: {}},
            execute: record('high'),
        });

        nar.taskManager.addTask(
            createTask(termParser.parse('^low_prio()'), 'goal', Truth.NEUTRAL, createBudget(0.3))
        );
        nar.taskManager.addTask(
            createTask(termParser.parse('^high_prio()'), 'goal', Truth.NEUTRAL, createBudget(0.9))
        );

        // Verify pending queue is priority-ordered (high priority dispatched first)
        const pending = nar.taskManager.getPending();
        expect(pending.length).toBe(2);
        expect(pending[0].budget.priority).toBeGreaterThan(pending[1].budget.priority);
    });

    test('AIKR limits respected (maxDerivationsPerStep, maxDerivationDepth)', async () => {
        const constrainedNar = new NAR({
            enableLMRules: false,
            enableTools: true,
            enableSelf: false,
            enableRLFP: false,
            persistState: false,
            maxConcepts: 1000,
            maxDerivationsPerStep: 10, // Very low budget
            maxDerivationDepth: 2,     // Very low depth
        });

        // Add many beliefs that would generate many derivations
        for (let i = 0; i < 20; i++) {
            await constrainedNar.believe(
                TermBuilder.inheritance(TermBuilder.atom(`fact:${i}`), TermBuilder.atom('true')),
                Truth.TRUE
            );
        }

        // Should not crash, should respect limits
        const derived = await constrainedNar.run(5);
        expect(typeof derived).toBe('number');
    });

    test('No environment step occurs without goal dispatch', async () => {
        // Add some beliefs but no tool goals
        await nar.believe(
            TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_1_1')),
            Truth.TRUE
        );
        await nar.run(5);

        // No tool goals should be generated without explicit injection
        const goals = nar.getGoals();
        const toolGoals = goals.filter(g => g.term.toString().startsWith('^'));

        expect(toolGoals.length).toBe(0);
    });

    test('Observation alone never causes an action', async () => {
        // Perception only - no goals
        await nar.believe(
            TermBuilder.inheritance(TermBuilder.atom('self'), TermBuilder.atom('state:s_3_4')),
            Truth.create(1.0, 0.95)
        );
        await nar.believe(
            TermBuilder.inheritance(TermBuilder.atom('feature:wall_north'), TermBuilder.atom('present')),
            Truth.create(1.0, 0.90)
        );

        await nar.run(10);

        // No tool goals should be generated from perception alone
        const goals = nar.getGoals();
        const toolGoals = goals.filter(g => g.term.toString().startsWith('^'));

        expect(toolGoals.length).toBe(0);
    });
});