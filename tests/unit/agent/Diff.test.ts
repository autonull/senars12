import {initialState, type State, type Belief, type Episode, type Goal} from '../../../src/agent/cycle/index.js';
import {diffStates, isEmptyDiff} from '../../../src/agent/cycle/index.js';

const belief = (term: string, priority = 0.5): Belief => ({term, truth: {f: 0.9, c: 0.9}, priority});
const episode = (id: string, input = 'x', response = 'y', tags: string[] = []): Episode =>
    ({id, input, response, tags, timestamp: 1000});
const goal = (id: string, statement: string): Goal =>
    ({id, statement, priority: 0.5, status: 'pending'});
const focus = (text: string) => ({
    kind: 'message' as const,
    source: 'cli',
    origin: 'cli:direct:user',
    sender: 'user',
    text,
    receivedAt: 1000,
});

describe('diffStates', () => {
    it('reports empty diff for identical states', () => {
        const a = initialState();
        const b = initialState();
        const d = diffStates(a, b);
        expect(isEmptyDiff(d)).toBe(true);
        expect(d.fromVersion).toBe(0);
        expect(d.toVersion).toBe(0);
    });

    it('detects added and removed beliefs', () => {
        const a: State = {...initialState(), beliefs: [belief('cat'), belief('dog')]};
        const b: State = {...initialState(), beliefs: [belief('dog'), belief('bird')]};
        const d = diffStates(a, b);
        expect(d.beliefsAdded.map(x => x.term)).toEqual(['bird']);
        expect(d.beliefsRemoved.map(x => x.term)).toEqual(['cat']);
    });

    it('detects added and removed episodes', () => {
        const a: State = {...initialState(), episodes: [episode('e1')]};
        const b: State = {...initialState(), episodes: [episode('e2')]};
        const d = diffStates(a, b);
        expect(d.episodesAdded.map(x => x.id)).toEqual(['e2']);
        expect(d.episodesRemoved.map(x => x.id)).toEqual(['e1']);
    });

    it('detects added and removed goals', () => {
        const a: State = {...initialState(), goals: [goal('g1', 'learn')]};
        const b: State = {...initialState(), goals: [goal('g2', 'teach')]};
        const d = diffStates(a, b);
        expect(d.goalsAdded.map(x => x.id)).toEqual(['g2']);
        expect(d.goalsRemoved.map(x => x.id)).toEqual(['g1']);
    });

    it('detects identity changes', () => {
        const a: State = {...initialState(), identity: {...initialState().identity, version: 1}};
        const b: State = {...initialState(), identity: {...initialState().identity, version: 2}};
        expect(diffStates(a, b).identityChanged).toBe(true);
        const same: State = {...initialState(), identity: {...initialState().identity, version: 1}};
        expect(diffStates(a, same).identityChanged).toBe(false);
    });

    it('detects attention changes', () => {
        const a: State = {...initialState(), attention: focus('one')};
        const b: State = {...initialState(), attention: focus('two')};
        expect(diffStates(a, b).attentionChanged).toBe(true);
    });

    it('detects null -> focus and focus -> null transitions', () => {
        const a: State = {...initialState(), attention: null};
        const b: State = {...initialState(), attention: focus('hi')};
        expect(diffStates(a, b).attentionChanged).toBe(true);
        expect(diffStates(b, a).attentionChanged).toBe(true);
    });

    it('detects budget changes', () => {
        const a: State = {...initialState(), budget: {...initialState().budget, tokensRemaining: 100}};
        const b: State = {...initialState(), budget: {...initialState().budget, tokensRemaining: 200}};
        expect(diffStates(a, b).budgetChanged).toBe(true);
    });

    it('captures version delta in fromVersion/toVersion', () => {
        const a: State = {...initialState(), version: 3};
        const b: State = {...initialState(), version: 7};
        const d = diffStates(a, b);
        expect(d.fromVersion).toBe(3);
        expect(d.toVersion).toBe(7);
    });
});

describe('isEmptyDiff', () => {
    it('true when nothing changed', () => {
        expect(isEmptyDiff(diffStates(initialState(), initialState()))).toBe(true);
    });
    it('false when beliefs added', () => {
        const d = diffStates(initialState(), {...initialState(), beliefs: [belief('x')]});
        expect(isEmptyDiff(d)).toBe(false);
    });
});
