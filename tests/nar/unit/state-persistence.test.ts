import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {
    BagStrategy,
    createBudget,
    DEFAULT_CONFIG,
    Memory,
    Reasoner,
    SeNARSFactory,
    TaskManager,
    TermBuilder,
    Truth,
} from '../../../nar/src';
import {NARExecution} from '../../../nar/src/nar-execution';
import type {RLFPLearner} from '../../../nar/src/rlfp';
import {createSeNARSRegistry} from '../../../nar/src/lm';
import {createLMService} from '../../../nar/src/lm/lm-service';
import {EventBus} from '@senars/util/events';
import {join} from 'node:path';
import {mkdir, readdir, readFile, rm} from 'node:fs/promises';

// Persistence assertions are LM-independent; default to the mock provider so
// this file stays hermetic (avoids downloading real weights). Explicit
// LM_PROVIDER in the environment still wins.
if (!process.env.LM_PROVIDER) process.env.LM_PROVIDER = 'mock';

const createMockProcessor = () => ({
    processSync: () => [],
    processLMRules: async function* () {
        /* noop */
    },
});

const createMockRLFP = (): RLFPLearner =>
    ({
        optimize: vi.fn(),
        updateModel: vi.fn(),
        policyOptimizerPublic: {} as any,
    }) as unknown as RLFPLearner;

describe('NAR State Persistence', () => {
    const testStateDir = join(process.cwd(), '.cache', 'test-state-persistence');

    beforeEach(async () => {
        await rm(testStateDir, {recursive: true, force: true});
        await mkdir(testStateDir, {recursive: true});
    });

    afterEach(async () => {
        await rm(testStateDir, {recursive: true, force: true});
    });

    test('saveState and loadState persist drives', async () => {
        const registry = createSeNARSRegistry();
        const lmService = createLMService();

        const nar = SeNARSFactory.createDefault({
            providerRegistry: registry,
            lmService,
            persistState: true,
            statePath: testStateDir,
            maxConcepts: 100,
        });

        await nar.start();

        // Stimulate drives to non-default values
        const driveManager = nar.getDriveManager();
        driveManager?.stimulate('competence', -0.3); // Should drop from ~0.8 to ~0.5
        driveManager?.stimulate('curiosity', 0.2);   // Should rise from ~0.5 to ~0.7

        // Run a cycle to let drives decay and get saved
        await nar.run(5);

        const drivesBefore = driveManager?.getAllStates().map(ds => ({id: ds.spec.id, intensity: ds.currentIntensity}));

        // Trigger save
        await nar.stop();

        // Verify files were created
        const files = await readdir(testStateDir);
        expect(files).toContain('drives.json');
        expect(files).toContain('beliefs.json');
        expect(files).toContain('goals.json');
        expect(files).toContain('questions.json');

        // Check drives.json content
        const drivesContent = JSON.parse(await readFile(join(testStateDir, 'drives.json'), 'utf-8'));
        const savedDrives = drivesContent;
        expect(savedDrives.competence).toBeDefined();
        expect(savedDrives.curiosity).toBeDefined();

        // Create new NAR instance and load state
        const nar2 = SeNARSFactory.createDefault({
            providerRegistry: registry,
            lmService,
            persistState: true,
            statePath: testStateDir,
            maxConcepts: 100,
        });

        await nar2.start();

        const driveManager2 = nar2.getDriveManager();
        const drivesAfter = driveManager2?.getAllStates().map(ds => ({id: ds.spec.id, intensity: ds.currentIntensity}));

        // Verify drives were restored (approximately)
        const competenceAfter = driveManager2?.getState('competence')?.currentIntensity ?? 0;
        const curiosityAfter = driveManager2?.getState('curiosity')?.currentIntensity ?? 0;

        // Values should be close to what was saved (allowing for decay during load)
        expect(competenceAfter).toBeLessThan(0.8); // Should be lower than default
        expect(curiosityAfter).toBeGreaterThan(0.5); // Should be higher than default

        await nar2.stop();
    });

    test('saveState persists beliefs, goals, and questions', async () => {
        const registry = createSeNARSRegistry();
        const lmService = createLMService();

        const nar = SeNARSFactory.createDefault({
            providerRegistry: registry,
            lmService,
            persistState: true,
            statePath: testStateDir,
            maxConcepts: 100,
        });

        await nar.start();

        // Add some beliefs, goals, questions using correct methods
        await nar.believe('(test_belief --> concept).');
        await nar.goal('(test_goal --> concept)!');
        await nar.question('(test_question --> ?what)?');

        await nar.run(2);
        await nar.stop();

        // Verify files exist
        const files = await readdir(testStateDir);
        expect(files).toContain('beliefs.json');
        expect(files).toContain('goals.json');
        expect(files).toContain('questions.json');

        // Create new NAR and load
        const nar2 = SeNARSFactory.createDefault({
            providerRegistry: registry,
            lmService,
            persistState: true,
            statePath: testStateDir,
            maxConcepts: 100,
        });

        await nar2.start();

        // Check beliefs were restored
        const beliefs = nar2.getBeliefs();
        const hasTestBelief = beliefs.some(b => b.term.toString().includes('test_belief'));
        expect(hasTestBelief).toBe(true);

        // Check goals were restored
        const goals = nar2.getGoals();
        const hasTestGoal = goals.some(g => g.term.toString().includes('test_goal'));
        expect(hasTestGoal).toBe(true);

        await nar2.stop();
    });
});

describe('NARExecution Observability Emission', () => {
    let memory: Memory;
    let taskManager: TaskManager;
    let reasoner: Reasoner;
    let rlfp: RLFPLearner;
    let execution: NARExecution;
    let eventBus: EventBus;

    beforeEach(() => {
        memory = new Memory({
            maxConcepts: 100,
            activationDecayRate: 0.01,
            consolidationInterval: 10,
        });
        taskManager = new TaskManager(memory);
        reasoner = new Reasoner(memory, createMockProcessor() as any, BagStrategy, {
            cpuThrottleMs: 0,
            maxDerivationDepth: 10,
            maxDerivationsPerStep: 100,
        });
        rlfp = createMockRLFP();
        eventBus = new EventBus();
        // Pass eventBus as the 9th parameter (systemEventBus)
        execution = new NARExecution(memory, taskManager, reasoner, DEFAULT_CONFIG, rlfp, undefined, undefined, undefined, eventBus);
    });

    test('emits cognitive state summary every 10 cycles', async () => {
        const emittedEvents: any[] = [];

        // Subscribe to event bus
        eventBus.on('cognitive:state:summary', (event: any) => {
            emittedEvents.push(event);
        });

        memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));

        // Run 15 cycles - should emit at cycle 10
        for (let i = 0; i < 15; i++) {
            await execution.run(1);
        }

        // Should have emitted at least once (at cycle 10)
        expect(emittedEvents.length).toBeGreaterThanOrEqual(1);

        // Check event structure
        const event = emittedEvents[0];
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('active_drives');
        expect(event).toHaveProperty('active_meta_goals');
        expect(event).toHaveProperty('pending_tool_executions');
        expect(event).toHaveProperty('aikr_pressure');
        expect(event).toHaveProperty('rlfp_reward_avg');
        expect(event).toHaveProperty('meta_derivation_budget_used');
    });

    test('does not emit before 10 cycles', async () => {
        const emittedEvents: any[] = [];

        eventBus.on('cognitive:state:summary', (event: any) => {
            emittedEvents.push(event);
        });

        memory.addTask(TermBuilder.atom('test'), 'belief', Truth.TRUE, createBudget(0.9));

        // Run 5 cycles - should not emit yet
        for (let i = 0; i < 5; i++) {
            await execution.run(1);
        }

        expect(emittedEvents.length).toBe(0);
    });
});