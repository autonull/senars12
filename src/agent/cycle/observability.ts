import type {State} from './State.js';
import type {Turn} from './Turn.js';
import type {JournalEntry, StateJournal} from './StateJournal.js';
import {diffStates, isEmptyDiff, type StateDiff} from './diff.js';
import {cycle, type CycleDeps} from './cycle.js';

const turnSummary = (t: Turn): string => {
    switch (t.kind) {
        case 'response': return `response(${t.text.length}b, c=${t.confidence.toFixed(2)})`;
        case 'tool_calls': return `tool_calls(${t.calls.length})`;
        case 'internal': return `internal(${t.note})`;
    }
};

const responseText = (t: Turn): string | null =>
    t.kind === 'response' ? t.text : null;

const toolCallNames = (t: Turn): readonly string[] | null =>
    t.kind === 'tool_calls' ? t.calls.map(c => c.name) : null;

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

const formatDiff = (d: StateDiff): string => {
    if (isEmptyDiff(d)) return '(no state changes)';
    const lines: string[] = [];
    if (d.beliefsAdded.length) lines.push(`+beliefs: ${d.beliefsAdded.map(b => b.term).join(', ')}`);
    if (d.beliefsRemoved.length) lines.push(`-beliefs: ${d.beliefsRemoved.map(b => b.term).join(', ')}`);
    if (d.episodesAdded.length) lines.push(`+episodes: ${d.episodesAdded.map(e => e.id).join(', ')}`);
    if (d.episodesRemoved.length) lines.push(`-episodes: ${d.episodesRemoved.map(e => e.id).join(', ')}`);
    if (d.goalsAdded.length) lines.push(`+goals: ${d.goalsAdded.map(g => g.statement).join(', ')}`);
    if (d.goalsRemoved.length) lines.push(`-goals: ${d.goalsRemoved.map(g => g.statement).join(', ')}`);
    if (d.identityChanged) lines.push('~identity: changed');
    if (d.attentionChanged) lines.push('~attention: changed');
    if (d.budgetChanged) lines.push('~budget: changed');
    return lines.join('\n');
};

const previewText = (s: string, max = 60): string =>
    s.length <= max ? s : `${s.slice(0, max - 1)}…`;

const formatTurnTextDiff = (original: readonly Turn[], replayed: readonly Turn[]): string | null => {
    if (original.length !== replayed.length) {
        return `turn count: ${original.length} → ${replayed.length}`;
    }
    const lines: string[] = [];
    for (let i = 0; i < original.length; i++) {
        const a = original[i]!;
        const b = replayed[i]!;
        if (a.kind !== b.kind) {
            lines.push(`turn[${i}]: kind ${a.kind} → ${b.kind}`);
            continue;
        }
        const aText = responseText(a);
        const bText = responseText(b);
        if (aText !== null && bText !== null && aText !== bText) {
            lines.push(`turn[${i}] text: "${previewText(aText)}" → "${previewText(bText)}"`);
        }
        const aCalls = toolCallNames(a);
        const bCalls = toolCallNames(b);
        if (aCalls && bCalls) {
            const aSet = new Set(aCalls);
            const bSet = new Set(bCalls);
            const added = bCalls.filter(n => !aSet.has(n));
            const removed = aCalls.filter(n => !bSet.has(n));
            if (added.length || removed.length) {
                lines.push(`turn[${i}] tool_calls: +${added.join(',')} -${removed.join(',')}`);
            }
        }
    }
    return lines.length === 0 ? null : lines.join('\n');
};

export const formatReplay = (entry: JournalEntry, replayed: {turns: readonly Turn[]; state: State}): string => {
    const stateDiff = diffStates(entry.state, replayed.state);
    const turnTextDiff = formatTurnTextDiff(entry.turns, replayed.turns);
    return [
        `--- REPLAY v${entry.version} ---`,
        `original turns: ${formatTurns(entry.turns)}`,
        `replay  turns: ${formatTurns(replayed.turns)}`,
        'state diff:',
        formatDiff(stateDiff),
        'turn diff:',
        turnTextDiff ?? '(turns match)',
    ].join('\n');
};

export const replayVersion = async (
    version: number,
    journal: StateJournal,
    deps: CycleDeps,
): Promise<{entry: JournalEntry; replayed: {turns: readonly Turn[]; state: State}} | null> => {
    const entry = journal.get(version);
    if (!entry) return null;
    const focus = entry.focus;
    if (!focus) return null;
    const result = await cycle(focus, entry.state, deps);
    return {entry, replayed: result};
};
