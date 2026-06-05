import type {StateJournal} from './StateJournal.js';
import type {CycleDeps} from './cycle.js';
import {formatDebug, formatTrace, replayVersion, formatReplay} from './observability.js';
import {restoreState} from './persistence.js';
import type {State} from './State.js';
import type {Turn} from './Turn.js';

export type OperatorResult = {readonly handled: true; readonly text: string} | {readonly handled: false};

export interface OperatorContext {
    readonly journal: StateJournal;
    readonly currentState: () => State;
    readonly currentTurns: () => readonly Turn[];
    readonly deps: CycleDeps;
    readonly stateDir?: string;
    readonly origin?: string;
    readonly setState?: (state: State) => void;
}

const TRACE_DEFAULT = 10;

const formatHelp = (): string => [
    '--- OPERATOR COMMANDS ---',
    '  !debug                  show current state',
    '  !trace [last N]         show last N journal entries (default 10)',
    '  !replay [turn N]        re-run cycle at version N (default latest)',
    '  !versions               list available snapshot versions',
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
): Promise<OperatorResult> => {
    if (!isOperator(text)) return {handled: false};
    const body = text.slice(1).trim();
    if (!body) return {handled: true, text: formatHelp()};

    const parts = body.split(/\s+/);
    const cmd = parts[0];
    if (!cmd) return {handled: true, text: formatHelp()};
    const args = parts.slice(1).join(' ');
    const lower = cmd.toLowerCase();

    if (lower === 'help' || lower === '?') return {handled: true, text: formatHelp()};

    if (lower === 'debug') {
        return {handled: true, text: formatDebug(ctx.currentState(), ctx.currentTurns())};
    }

    if (lower === 'trace') {
        const parsed = parseTraceArgs(args);
        if ('error' in parsed) return {handled: true, text: parsed.error};
        return {handled: true, text: formatTrace(ctx.journal, parsed.n)};
    }

    if (lower === 'replay') {
        const parsed = parseReplayArgs(args);
        if ('error' in parsed) return {handled: true, text: parsed.error};
        const version = parsed.version === 'latest'
            ? (ctx.journal.latest()?.version ?? -1)
            : parsed.version;
        if (version < 0) return {handled: true, text: 'no turns recorded yet'};
        const result = await replayVersion(version, ctx.journal, ctx.deps);
        if (!result) return {handled: true, text: `no entry at version ${version}`};
        return {handled: true, text: formatReplay(result.entry, result.replayed)};
    }

    if (lower === 'versions') {
        if (ctx.journal.size() === 0) return {handled: true, text: 'no versions in journal'};
        const lines = ['--- VERSIONS ---'];
        for (const v of ctx.journal.versions()) lines.push(`  v${v}`);
        return {handled: true, text: lines.join('\n')};
    }

    if (lower === 'rollback') {
        const trimmed = args.trim();
        const n = Number(trimmed);
        if (!trimmed || !Number.isInteger(n) || n < 0) {
            return {handled: true, text: 'usage: !rollback <version>'};
        }
        if (!ctx.stateDir || !ctx.origin) {
            return {handled: true, text: '!rollback not available in this context'};
        }
        const {join} = await import('node:path');
        const dir = join(ctx.stateDir, encodeURIComponent(ctx.origin));
        const snap = await restoreState(n, dir);
        if (!snap) return {handled: true, text: `no snapshot at version ${n}`};
        ctx.setState?.(snap.state);
        return {handled: true, text: `rolled back to v${n} (state reverted; next cycle starts from here)`};
    }

    return {handled: true, text: `unknown command: !${cmd}\n${formatHelp()}`};
};

