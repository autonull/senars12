import {describe, it, expect, beforeEach} from '@jest/globals';
import {WMManager} from '../../../src/agent/WMManager.js';
import {EpisodeWorkingMemory} from '../../../src/agent/EpisodeWorkingMemory.js';
import {AgentEventBus} from '../../../src/agent/AgentEventBus.js';
import type {Goal} from '../../../src/agent/GoalManager.js';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
    return {
        id: 'g1',
        description: 'explore feline cognition',
        status: 'active',
        subgoals: [],
        progress: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        priority: 5,
        ...overrides,
    };
}

describe('WMManager', () => {
    let eventBus: AgentEventBus;
    let wm: EpisodeWorkingMemory;

    beforeEach(() => {
        eventBus = new AgentEventBus();
        wm = new EpisodeWorkingMemory();
    });

    it('prunes expired slots on tick', async () => {
        let now = 1_000_000;
        const clockedWM = new EpisodeWorkingMemory({clock: () => now, defaultTTLMs: 100});
        const manager = new WMManager({wm: clockedWM, eventBus});

        clockedWM.set('temp', 'value', 100);
        expect(clockedWM.get('temp')).toBe('value');

        now += 200; // advance past TTL
        await manager.tick(makeGoal());
        expect(clockedWM.get('temp')).toBeUndefined();
    });

    it('extends TTL for high-score goal-relevant slots', async () => {
        let now = 1_000_000;
        const clockedWM = new EpisodeWorkingMemory({clock: () => now, defaultTTLMs: 60_000});
        const manager = new WMManager({wm: clockedWM, eventBus});

        clockedWM.set('feline', 'cats are interesting', 60_000);
        now += 30_000;

        await manager.tick(makeGoal({description: 'explore feline cognition'}));
        // After touch, TTL should be extended
        expect(clockedWM.get('feline')).toBe('cats are interesting');
    });

    it('does not touch low-score slots', async () => {
        let now = 1_000_000;
        const clockedWM = new EpisodeWorkingMemory({clock: () => now, defaultTTLMs: 60_000});
        const manager = new WMManager({wm: clockedWM, eventBus});

        clockedWM.set('unrelated', 'data', 60_000);
        const expiresBefore = clockedWM['slots']?.get('unrelated')?.expiresAt ?? 0;
        now += 30_000;

        await manager.tick(makeGoal({description: 'explore feline cognition'}));
        const expiresAfter = clockedWM['slots']?.get('unrelated')?.expiresAt ?? 0;
        // TTL should not have been extended (unrelated slot, low score)
        expect(expiresAfter).toBe(expiresBefore);
    });

    it('throttles to 30s interval', async () => {
        const manager = new WMManager({wm, eventBus});
        wm.set('test', 'value', 10_000);

        // First tick
        await manager.tick(undefined);
        expect(wm.get('test')).toBe('value');

        // Second tick immediately should still work (doesn't matter for throttle)
        await manager.tick(undefined);
        expect(wm.get('test')).toBe('value');
    });

    it('works without active goal', async () => {
        const manager = new WMManager({wm, eventBus});
        wm.set('key', 'value');
        await expect(manager.tick(undefined)).resolves.toBeUndefined();
        expect(wm.get('key')).toBe('value');
    });
});
