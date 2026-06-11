import {describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import {mkdtempSync, rmSync, existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {GoalManager} from '../../../src/agent/GoalManager.js';
import {AgentEventBus} from '../../../src/agent/AgentEventBus.js';
import {EpisodicMemory} from '../../../src/nar/memory/EpisodicMemory.js';

describe('GoalManager', () => {
    let eventBus: AgentEventBus;
    let tmpDir: string;

    beforeEach(() => {
        eventBus = new AgentEventBus();
        tmpDir = mkdtempSync(join(tmpdir(), 'gm-test-'));
    });

    afterEach(() => {
        rmSync(tmpDir, {recursive: true, force: true});
    });

    it('addGoal creates a goal with correct fields', () => {
        const gm = new GoalManager({eventBus});
        const goal = gm.addGoal('learn about cats', 5);
        expect(goal.id).toBeDefined();
        expect(goal.description).toBe('learn about cats');
        expect(goal.status).toBe('pending');
        expect(goal.progress).toBe(0);
        expect(goal.priority).toBe(5);
        expect(goal.subgoals).toEqual([]);
        expect(goal.createdAt).toBeGreaterThan(0);
        expect(goal.updatedAt).toBeGreaterThan(0);
    });

    it('getActiveGoal returns undefined when no active goal', () => {
        const gm = new GoalManager({eventBus});
        gm.addGoal('test goal');
        expect(gm.getActiveGoal()).toBeUndefined();
    });

    it('advance promotes highest priority pending goal to active', () => {
        const gm = new GoalManager({eventBus});
        gm.addGoal('low priority', 1);
        gm.addGoal('high priority', 10);
        gm.addGoal('medium priority', 5);

        const active = gm.advance();
        expect(active).toBeDefined();
        expect(active!.description).toBe('high priority');
        expect(active!.status).toBe('active');
    });

    it('advance returns existing active goal', () => {
        const gm = new GoalManager({eventBus});
        gm.addGoal('first', 1);
        const first = gm.advance();
        gm.addGoal('second', 10);
        const active = gm.advance();
        expect(active).toBe(first);
        expect(active!.description).toBe('first');
    });

    it('completeGoal marks goal done and progresses to next', () => {
        const gm = new GoalManager({eventBus});
        gm.addGoal('goal a', 1);
        gm.addGoal('goal b', 2);

        const first = gm.advance();
        expect(first!.description).toBe('goal b');
        gm.completeGoal(first!.id);

        const next = gm.advance();
        expect(next!.description).toBe('goal a');
        expect(next!.status).toBe('active');
    });

    it('failGoal marks goal failed', () => {
        const gm = new GoalManager({eventBus});
        gm.addGoal('test');
        const g = gm.advance();
        gm.failGoal(g!.id);
        expect(g!.status).toBe('failed');
        expect(gm.getActiveGoal()).toBeUndefined();
    });

    it('blockGoal marks goal blocked', () => {
        const gm = new GoalManager({eventBus});
        gm.addGoal('test');
        const g = gm.advance();
        gm.blockGoal(g!.id);
        expect(g!.status).toBe('blocked');
    });

    it('updateProgress clamps value between 0 and 1', () => {
        const gm = new GoalManager({eventBus});
        const g = gm.addGoal('test');
        gm.updateProgress(g.id, 0.5);
        expect(g.progress).toBe(0.5);
        gm.updateProgress(g.id, 1.5);
        expect(g.progress).toBe(1);
        gm.updateProgress(g.id, -0.5);
        expect(g.progress).toBe(0);
    });

    it('addSubgoal creates child and links to parent', () => {
        const gm = new GoalManager({eventBus});
        const parent = gm.addGoal('parent', 5);
        const child = gm.addSubgoal(parent.id, 'child', 3);
        expect(child).toBeDefined();
        expect(child!.description).toBe('child');
        expect(child!.subgoals).toContain(parent.id);
        expect(parent.subgoals).toContain(child!.id);
    });

    it('addSubgoal returns undefined for missing parent', () => {
        const gm = new GoalManager({eventBus});
        const child = gm.addSubgoal('nonexistent', 'child');
        expect(child).toBeUndefined();
    });

    it('persist writes to file and load restores state', async () => {
        const persistPath = join(tmpDir, 'goals.json');
        const gm = new GoalManager({eventBus, persistPath});
        gm.addGoal('test goal', 3);
        await gm.persist();

        expect(existsSync(persistPath)).toBe(true);
        const raw = JSON.parse(readFileSync(persistPath, 'utf-8'));
        expect(raw).toHaveLength(1);
        expect(raw[0].description).toBe('test goal');

        const gm2 = new GoalManager({eventBus, persistPath});
        await gm2.load();
        expect(gm2.getGoals()).toHaveLength(1);
        expect(gm2.getGoals()[0]!.description).toBe('test goal');
    });

    it('load handles missing file gracefully', async () => {
        const gm = new GoalManager({eventBus, persistPath: '/nonexistent/path/goals.json'});
        await expect(gm.load()).resolves.toBeUndefined();
        expect(gm.getGoals()).toHaveLength(0);
    });

    it('persist logs to episodic memory if available', async () => {
        const ep = new EpisodicMemory({
            enabled: true,
            basePath: tmpDir,
            retentionDays: 1,
            maxEntriesPerFile: 100,
        });
        const gm = new GoalManager({eventBus, episodicMemory: ep});
        gm.addGoal('memory goal');
        await gm.persist();

        const episodes = await ep.getEpisodes({limit: 10});
        expect(episodes.some(e => e.metadata?.kind === 'goal_snapshot')).toBe(true);
    });

    it('getGoals returns read-only snapshot', () => {
        const gm = new GoalManager({eventBus});
        const g = gm.addGoal('test');
        const goals = gm.getGoals();
        expect(goals).toHaveLength(1);
        expect(goals[0]).toBe(g);
    });

    it('emits goal:created on add', () => {
        const events: string[] = [];
        eventBus.on('goal:created', () => { events.push('created'); });
        const gm = new GoalManager({eventBus});
        gm.addGoal('test');
        expect(events).toContain('created');
    });

    it('emits goal:started on advance', () => {
        const events: string[] = [];
        eventBus.on('goal:started', () => { events.push('started'); });
        const gm = new GoalManager({eventBus});
        gm.addGoal('test');
        gm.advance();
        expect(events).toContain('started');
    });

    it('emits goal:completed on complete', () => {
        const events: string[] = [];
        eventBus.on('goal:completed', () => { events.push('completed'); });
        const gm = new GoalManager({eventBus});
        const g = gm.addGoal('test');
        gm.advance();
        gm.completeGoal(g.id);
        expect(events).toContain('completed');
    });

    it('emits goal:failed on fail', () => {
        const events: string[] = [];
        eventBus.on('goal:failed', () => { events.push('failed'); });
        const gm = new GoalManager({eventBus});
        const g = gm.addGoal('test');
        gm.advance();
        gm.failGoal(g.id);
        expect(events).toContain('failed');
    });
});
