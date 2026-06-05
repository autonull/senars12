import type {Belief, Episode, Goal, Identity, State} from './State.js';

export interface StateDiff {
    readonly fromVersion: number;
    readonly toVersion: number;
    readonly beliefsAdded: readonly Belief[];
    readonly beliefsRemoved: readonly Belief[];
    readonly episodesAdded: readonly Episode[];
    readonly episodesRemoved: readonly Episode[];
    readonly goalsAdded: readonly Goal[];
    readonly goalsRemoved: readonly Goal[];
    readonly identityChanged: boolean;
    readonly attentionChanged: boolean;
    readonly budgetChanged: boolean;
}

const beliefKey = (b: Belief): string => b.term;
const episodeKey = (e: Episode): string => e.id;
const goalKey = (g: Goal): string => g.id;
const setDiff = <T>(a: readonly T[], b: readonly T[], key: (t: T) => string): {
    added: readonly T[];
    removed: readonly T[];
} => {
    const aKeys = new Set(a.map(key));
    const bKeys = new Set(b.map(key));
    return {
        added: b.filter(x => !aKeys.has(key(x))),
        removed: a.filter(x => !bKeys.has(key(x))),
    };
};

const identityEqual = (a: Identity, b: Identity): boolean =>
    a.version === b.version
    && a.beliefs.length === b.beliefs.length
    && a.skills.length === b.skills.length
    && a.goals.length === b.goals.length
    && a.beliefs.every((x, i) => x.term === b.beliefs[i]?.term)
    && a.skills.every((x, i) => x === b.skills[i])
    && a.goals.every((x, i) => x === b.goals[i]);

const attentionEqual = (a: State, b: State): boolean => {
    const x = a.attention;
    const y = b.attention;
    if (x === null && y === null) return true;
    if (x === null || y === null) return false;
    return x.text === y.text && x.sender === y.sender && x.source === y.source;
};

const budgetEqual = (a: State, b: State): boolean => {
    const x = a.budget;
    const y = b.budget;
    return x.tokensRemaining === y.tokensRemaining
        && x.stepsRemaining === y.stepsRemaining
        && x.deadline === y.deadline
        && x.maxOutputTokens === y.maxOutputTokens;
};

export const diffStates = (a: State, b: State): StateDiff => {
    const beliefs = setDiff(a.beliefs, b.beliefs, beliefKey);
    const episodes = setDiff(a.episodes, b.episodes, episodeKey);
    const goals = setDiff(a.goals, b.goals, goalKey);
    return {
        fromVersion: a.version,
        toVersion: b.version,
        beliefsAdded: beliefs.added,
        beliefsRemoved: beliefs.removed,
        episodesAdded: episodes.added,
        episodesRemoved: episodes.removed,
        goalsAdded: goals.added,
        goalsRemoved: goals.removed,
        identityChanged: !identityEqual(a.identity, b.identity),
        attentionChanged: !attentionEqual(a, b),
        budgetChanged: !budgetEqual(a, b),
    };
};

export const isEmptyDiff = (d: StateDiff): boolean =>
    d.beliefsAdded.length === 0
    && d.beliefsRemoved.length === 0
    && d.episodesAdded.length === 0
    && d.episodesRemoved.length === 0
    && d.goalsAdded.length === 0
    && d.goalsRemoved.length === 0
    && !d.identityChanged
    && !d.attentionChanged
    && !d.budgetChanged;
