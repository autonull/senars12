import type {State} from './State.js';
import type {Turn} from './Turn.js';
import type {JournalEntry, StateJournal} from './StateJournal.js';
import {diffStates, isEmptyDiff, type StateDiff} from './persistence.js';
import {cycle} from './cycle.js';
import type {Reasoner} from './reason.js';

const turnSummary = (t: Turn): string => {
    switch (t.kind) {
        case 'response': return `response(${t.text.length}b, c=${t.confidence.toFixed(2)})`;
        case 'tool_calls': return `tool_calls(${t.calls.length})`;
        case 'internal': return `internal(${t.note})`;
    }
};

const formatStateLine = (s: State): string => {
    const focus = s.attention ? `focus="${s.attention.text.slice(0, 30)}"` : 'focus=none';
    return `v${s.version} beliefs=${s.beliefs.length} episodes=${s.episodes.length} ` +
        `goals=${s.goals.length} budget={steps:${s.budget.stepsRemaining},tokens:${s.budget.tokensRemaining}} ${focus}`;
};

const formatTurns = (turns: readonly Turn[]): string =>
    turns.map(turnSummary).join(' | ');

export const formatDebug = (state: State, turns: readonly Turn[] = []): string => {
    const lines = [
        '--- DEBUG ---',
        formatStateLine(state),
        `identity: v${state.identity.version}, ${state.identity.beliefs.length} beliefs, ${state.identity.skills.length} skills, ${state.identity.goals.length} goals`,
        `interrupt: ${state.interrupted}`,
        `turns(${turns.length}): ${formatTurns(turns)}`,
    ];
    return lines.join('\n');
};

const formatEntry = (e: JournalEntry): string => {
    const ts = new Date(e.recordedAt).toISOString();
    const focus = e.focus ? `"${e.focus.text.slice(0, 40)}"` : 'none';
    return `[${ts}] v${e.version}  focus=${focus}  turns=${formatTurns(e.turns)}`;
};

export const formatTrace = (journal: StateJournal, n: number): string => {
    if (journal.size() === 0) {
        return `--- TRACE (last ${n}) ---\n(empty journal)`;
    }
    const entries = journal.last(n);
    const lines = [`--- TRACE (last ${entries.length} of ${journal.size()}) ---`];
    for (const e of entries) lines.push(formatEntry(e));
    return lines.join('\n');
};

const formatStateDiff = (d: StateDiff): string => {
    if (isEmptyDiff(d)) return 'state: no changes';
    const parts: string[] = [];
    if (d.beliefsAdded.length) parts.push(`beliefs+${d.beliefsAdded.length}`);
    if (d.beliefsRemoved.length) parts.push(`beliefs-${d.beliefsRemoved.length}`);
    if (d.episodesAdded.length) parts.push(`episodes+${d.episodesAdded.length}`);
    if (d.episodesRemoved.length) parts.push(`episodes-${d.episodesRemoved.length}`);
    if (d.goalsAdded.length) parts.push(`goals+${d.goalsAdded.length}`);
    if (d.goalsRemoved.length) parts.push(`goals-${d.goalsRemoved.length}`);
    if (d.identityChanged) parts.push('identity:changed');
    if (d.attentionChanged) parts.push('attention:changed');
    if (d.budgetChanged) parts.push('budget:changed');
    return `state: ${parts.join(', ')}`;
};

const turnText = (t: Turn): string | null => t.kind === 'response' ? t.text : null;
const turnSize = (t: Turn): number => turnText(t)?.length ?? 0;

const formatTurnDiff = (original: readonly Turn[], replayed: readonly Turn[]): string => {
    if (original.length !== replayed.length) {
        return `turn count: ${original.length} → ${replayed.length}`;
    }
    const lines: string[] = [];
    for (let i = 0; i < original.length; i++) {
        const a = original[i]!;
        const b = replayed[i]!;
        const aSize = turnSize(a);
        const bSize = turnSize(b);
        if (a.kind === 'response' && b.kind === 'response' && a.text === b.text) {
            lines.push(`turn[${i}]: ${aSize}b (matches)`);
        } else {
            lines.push(`turn[${i}]: ${aSize}b → ${bSize}b`);
        }
    }
    return lines.join('\n');
};

export const formatReplay = (entry: JournalEntry, replayed: {turn: Turn; state: State}): string => {
    const stateDiff = diffStates(entry.state, replayed.state);
    return [
        `--- REPLAY v${entry.version} ---`,
        formatStateDiff(stateDiff),
        formatTurnDiff(entry.turns, [replayed.turn]),
    ].join('\n');
};

export const replayVersion = async (
    version: number,
    journal: StateJournal,
    reasoner: Reasoner,
): Promise<{entry: JournalEntry; replayed: {turn: Turn; state: State}} | null> => {
    const entry = journal.get(version);
    if (!entry) return null;
    const focus = entry.focus;
    if (!focus) return null;
    const result = await cycle(focus, entry.state, reasoner);
    return {entry, replayed: result};
};
