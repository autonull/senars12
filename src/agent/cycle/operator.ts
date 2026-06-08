import type {StateJournal} from './StateJournal.js';
import {formatDebug, formatTrace, replayVersion, formatReplay} from './observability.js';
import type {State} from './State.js';
import type {Turn} from './Turn.js';
import type {Reasoner} from './reason.js';

export type OperatorAction =
    | {readonly kind: 'response'; readonly text: string}
    | {readonly kind: 'rollback'; readonly version: number}
    | {readonly kind: 'unhandled'};

export interface OperatorContext {
    readonly journal: StateJournal;
    readonly currentState: () => State;
    readonly currentTurns: () => readonly Turn[];
    readonly reasoner: Reasoner;
}

const TRACE_DEFAULT = 10;

const formatHelp = (): string => [
    '--- OPERATOR COMMANDS ---',
    '  !debug                  show current state',
    '  !trace [last N]         show last N journal entries (default 10)',
    '  !replay [turn N]        re-run cycle at version N (default latest)',
    '  !rollback <version>     restore state from snapshot N',
    '  !help                   show this help',
].join('\n');

const parseTraceArgs = (args: string): {n: number} | {error: string} => {
    const trimmed = args.trim();
    if (!trimmed) return {n: TRACE_DEFAULT};
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2 && parts[0] === 'last') {
        const n = Number(parts[1]);
        if (!Number.isInteger(n) || n <= 0) return {error: `invalid N: ${parts[1]}`};
        return {n};
    }
    if (parts.length === 1) {
        const n = Number(parts[0]);
        if (!Number.isInteger(n) || n <= 0) return {error: `invalid N: ${parts[0]}`};
        return {n};
    }
    return {error: 'usage: !trace [last] [N]'};
};

const parseReplayArgs = (args: string): {version: number | 'latest'} | {error: string} => {
    const trimmed = args.trim();
    if (!trimmed) return {version: 'latest'};
    const parts = trimmed.split(/\s+/);
    if (parts.length === 2 && parts[0] === 'turn') {
        const v = Number(parts[1]);
        if (!Number.isInteger(v) || v < 0) return {error: `invalid version: ${parts[1]}`};
        return {version: v};
    }
    if (parts.length === 1) {
        const v = Number(parts[0]);
        if (!Number.isInteger(v) || v < 0) return {error: `invalid version: ${parts[0]}`};
        return {version: v};
    }
    return {error: 'usage: !replay [turn N]'};
};

const isOperator = (text: string): boolean => text.startsWith('!');

export const runOperatorCommand = async (
    text: string,
    ctx: OperatorContext,
): Promise<OperatorAction> => {
    if (!isOperator(text)) return {kind: 'unhandled'};
    const body = text.slice(1).trim();
    if (!body) return {kind: 'response', text: formatHelp()};

    const parts = body.split(/\s+/);
    const cmd = parts[0];
    if (!cmd) return {kind: 'response', text: formatHelp()};
    const args = parts.slice(1).join(' ');
    const lower = cmd.toLowerCase();

    if (lower === 'help' || lower === '?') return {kind: 'response', text: formatHelp()};

    if (lower === 'debug') {
        return {kind: 'response', text: formatDebug(ctx.currentState(), ctx.currentTurns())};
    }

    if (lower === 'trace') {
        const parsed = parseTraceArgs(args);
        if ('error' in parsed) return {kind: 'response', text: parsed.error};
        return {kind: 'response', text: formatTrace(ctx.journal, parsed.n)};
    }

    if (lower === 'replay') {
        const parsed = parseReplayArgs(args);
        if ('error' in parsed) return {kind: 'response', text: parsed.error};
        const version = parsed.version === 'latest'
            ? (ctx.journal.latest()?.version ?? -1)
            : parsed.version;
        if (version < 0) return {kind: 'response', text: 'no turns recorded yet'};
        const result = await replayVersion(version, ctx.journal, ctx.reasoner);
        if (!result) return {kind: 'response', text: `no entry at version ${version}`};
        return {kind: 'response', text: formatReplay(result.entry, result.replayed)};
    }

    if (lower === 'rollback') {
        const trimmed = args.trim();
        const n = Number(trimmed);
        if (!trimmed || !Number.isInteger(n) || n < 0) {
            return {kind: 'response', text: 'usage: !rollback <version>'};
        }
        return {kind: 'rollback', version: n};
    }

    return {kind: 'response', text: `unknown command: !${cmd}\n${formatHelp()}`};
};
