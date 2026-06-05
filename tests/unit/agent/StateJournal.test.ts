import {StateJournal, initialState, type State, type Turn, type Focus} from '../../../src/agent/cycle/index.js';

const focus = (text: string): Focus => ({
    kind: 'message', source: 'cli', origin: 'cli:direct:user', sender: 'user', text, receivedAt: 1000,
});

const entry = (version: number, text: string = 'x', now: number = 1000): {state: State; turns: Turn[]; focus: Focus | null} => {
    const turns: Turn[] = [{kind: 'response', text, confidence: 0.5}];
    return {state: {...initialState(), version}, turns, focus: focus(text)};
};

describe('StateJournal', () => {
    it('starts empty', () => {
        const j = new StateJournal();
        expect(j.size()).toBe(0);
        expect(j.latest()).toBeNull();
        expect(j.last(10)).toEqual([]);
        expect(j.all()).toEqual([]);
    });

    it('records entries and returns the recorded one', () => {
        const j = new StateJournal();
        const e = j.record({...initialState(), version: 1}, [{kind: 'response', text: 'hi', confidence: 0.5}]);
        expect(e.version).toBe(1);
        expect(j.size()).toBe(1);
        expect(j.latest()!.version).toBe(1);
    });

    it('get() returns the entry at the given version', () => {
        const j = new StateJournal();
        j.record({...initialState(), version: 1}, []);
        j.record({...initialState(), version: 2}, []);
        expect(j.get(1)?.version).toBe(1);
        expect(j.get(2)?.version).toBe(2);
        expect(j.get(3)).toBeNull();
    });

    it('last(n) returns the last n entries', () => {
        const j = new StateJournal();
        for (let i = 1; i <= 5; i++) j.record({...initialState(), version: i}, []);
        expect(j.last(2).map(e => e.version)).toEqual([4, 5]);
        expect(j.last(10).map(e => e.version)).toEqual([1, 2, 3, 4, 5]);
    });

    it('last(0) and last(negative) return []', () => {
        const j = new StateJournal();
        j.record({...initialState(), version: 1}, []);
        expect(j.last(0)).toEqual([]);
        expect(j.last(-1)).toEqual([]);
    });

    it('versions() returns recorded versions in order', () => {
        const j = new StateJournal();
        j.record({...initialState(), version: 7}, []);
        j.record({...initialState(), version: 3}, []);
        j.record({...initialState(), version: 5}, []);
        expect(j.versions()).toEqual([7, 3, 5]);
    });

    it('enforces maxEntries with FIFO eviction', () => {
        const j = new StateJournal({maxEntries: 3});
        j.record({...initialState(), version: 1}, []);
        j.record({...initialState(), version: 2}, []);
        j.record({...initialState(), version: 3}, []);
        j.record({...initialState(), version: 4}, []);
        expect(j.size()).toBe(3);
        expect(j.versions()).toEqual([2, 3, 4]);
    });

    it('uses injected clock for recordedAt', () => {
        let t = 5000;
        const j = new StateJournal({now: () => t});
        const e = j.record({...initialState(), version: 1}, []);
        expect(e.recordedAt).toBe(5000);
        t = 9000;
        j.record({...initialState(), version: 2}, []);
        expect(j.latest()!.recordedAt).toBe(9000);
    });

    it('clear() empties the journal', () => {
        const j = new StateJournal();
        j.record({...initialState(), version: 1}, []);
        j.clear();
        expect(j.size()).toBe(0);
        expect(j.latest()).toBeNull();
    });

    it('default focus is state.attention when not provided', () => {
        const j = new StateJournal();
        const s: State = {...initialState(), version: 1, attention: focus('hello')};
        const e = j.record(s, []);
        expect(e.focus?.text).toBe('hello');
    });
});

describe('StateJournal integration with entry()', () => {
    it('round-trips a sequence of state entries', () => {
        const j = new StateJournal();
        for (let v = 1; v <= 4; v++) {
            const e = entry(v, `msg${v}`);
            j.record(e.state, e.turns, e.focus);
        }
        expect(j.size()).toBe(4);
        expect(j.last(2).map(e => e.state.version)).toEqual([3, 4]);
        expect(j.get(2)?.turns[0]).toMatchObject({kind: 'response', text: 'msg2'});
    });
});
