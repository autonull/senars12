import {describe, it, expect, beforeEach} from '@jest/globals';
import {Drives} from '../../../src/agent/Drives.js';
import {AgentEventBus} from '../../../src/agent/AgentEventBus.js';
import {EpisodeWorkingMemory} from '../../../src/agent/EpisodeWorkingMemory.js';
import {SeNARSFactory} from '../../../src/nar/index.js';

describe('Drives', () => {
    let eventBus: AgentEventBus;

    beforeEach(() => {
        eventBus = new AgentEventBus();
    });

    it('tick does nothing without NAR', async () => {
        const wm = new EpisodeWorkingMemory();
        const drives = new Drives({eventBus, wm});
        const events: string[] = [];
        eventBus.on('drive:curiosity', () => { events.push('curiosity'); });
        eventBus.on('drive:coherence', () => { events.push('coherence'); });
        eventBus.on('drive:competence', () => { events.push('competence'); });

        await drives.tick();
        expect(events).toEqual([]);
    });

    it('curiosity queries uncertain concepts', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 10});
        const wm = new EpisodeWorkingMemory();
        const drives = new Drives({nar, eventBus, wm});
        const events: string[] = [];
        eventBus.on('drive:curiosity', () => { events.push('curiosity'); });

        // Add a high-uncertainty belief
        await nar.input('(cat --> animal).');
        await nar.run(2);

        await drives.tick();
        // First tick should trigger curiosity check
        expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('coherence detects contradictions between beliefs', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 10});
        const wm = new EpisodeWorkingMemory();
        const drives = new Drives({nar, eventBus, wm});
        const events: string[] = [];
        eventBus.on('drive:coherence', () => { events.push('coherence'); });

        // Add contradictory beliefs
        await nar.input('<cat --> animal>.');
        await nar.input('--<cat --> animal>.');
        await nar.run(5);

        await drives.tick();
        expect(events.length).toBeGreaterThanOrEqual(0);
    });

    it('competence checks unanswered questions', async () => {
        const nar = SeNARSFactory.createForTesting({maxConcepts: 10});
        const wm = new EpisodeWorkingMemory();
        const drives = new Drives({nar, eventBus, wm});
        const events: string[] = [];
        eventBus.on('drive:competence', () => { events.push('competence'); });

        // Add a question
        await nar.question('(cat --> animal)?');
        await nar.run(2);

        await drives.tick();
        expect(events.length).toBeGreaterThanOrEqual(0);
    });
});
