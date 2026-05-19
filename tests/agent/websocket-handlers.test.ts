import {NarService} from '../../src/agent/services/NarService.js';
import {NAR} from '../../src/nar/index.js';

describe('WebSocket Handlers - NarService', () => {
    let nar: NAR;
    let service: NarService;

    beforeEach(() => {
        nar = new NAR({
            maxConcepts: 100,
            priorityThreshold: 0.1,
            activationDecayRate: 0.01,
            consolidationInterval: 10,
            cpuThrottleMs: 10,
            maxDerivationDepth: 10,
            maxDerivationsPerStep: 100
        });
        service = new NarService(nar);
    });

    afterEach(async () => {
        try {
            await nar.dispose();
        } catch {
            // Ignore disposal errors
        }
    });

    test('addBelief: adds belief', async () => {
        const result = await service.addBelief('(bird --> animal).');
        expect(result.added).toBe(true);
        expect(result.term).toBe('(bird --> animal).');
        const beliefs = nar.getBeliefs();
        expect(beliefs.length).toBeGreaterThan(0);
    });

    test('addGoal: adds goal', async () => {
        const result = await service.addGoal('(want --> food).!');
        expect(result.added).toBe(true);
        expect(result.term).toBe('(want --> food).!');
        const goals = nar.getGoals();
        expect(goals.length).toBeGreaterThan(0);
    });

    test('addQuestion: adds question', async () => {
        const result = await service.addQuestion('(bird --> ?).');
        expect(result.added).toBe(true);
        expect(result.term).toBe('(bird --> ?).');
        const questions = nar.getQuestions();
        expect(questions.length).toBeGreaterThan(0);
    });

    test('getConcepts: lists with pagination', async () => {
        await service.addBelief('(a --> b).');
        await service.addBelief('(c --> d).');
        const result = await service.getConcepts({}, {limit: 1, offset: 0});
        expect(result.count).toBe(2);
        expect(result.results).toHaveLength(1);
    });

    test('getConcepts: filters by type', async () => {
        await service.addBelief('(a --> b).');
        await service.addGoal('(c --> d).!');

        const beliefs = await service.getConcepts({type: 'belief'});
        expect(beliefs.count).toBe(1);

        const goals = await service.getConcepts({type: 'goal'});
        expect(goals.count).toBe(1);
    });

    test('run: executes inference', async () => {
        await service.addBelief('(bird --> animal).');
        const result = await service.run(3);
        expect(typeof result.derived).toBe('number');
    });

    test('getStats: returns statistics', async () => {
        await service.addBelief('(bird --> animal).');
        const stats = await service.getStats();
        expect(stats.totalConcepts).toBeGreaterThanOrEqual(0);
        expect(typeof stats.derivations).toBe('number');
    });

    test('getConfig: returns configuration', async () => {
        const config = service.getConfig();
        expect(config).toBeDefined();
        expect(typeof config).toBe('object');
    });

    test('getAttentionSnapshot: returns attention report', async () => {
        await service.addBelief('(bird --> animal).');
        const snapshot = service.getAttentionSnapshot();
        expect(snapshot.total).toBeGreaterThanOrEqual(0);
    });
});
