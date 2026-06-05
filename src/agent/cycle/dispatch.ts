import {join} from 'node:path';
import {
    cycle,
    initialState,
    episodeReasoner,
    patternValidator,
    snapshotState,
    runOperatorCommand,
    StateJournal,
    listSnapshots,
    enforceRetention,
    type State,
    type Focus,
    type Turn,
    type CycleDeps,
    type OperatorContext,
} from './index.js';

export interface DispatchState {
    readonly states: Map<string, State>;
    readonly journals: Map<string, StateJournal>;
    readonly stateDir: string;
    readonly queues?: Map<string, Promise<unknown>>;
}

export interface DispatchInput {
    readonly origin: string;
    readonly connectionId: string;
    readonly connectionType: string;
    readonly sender: string;
    readonly text: string;
    readonly timestamp: number;
    readonly episodeCtx?: Record<string, unknown>;
    readonly deps?: CycleDeps;
}

export interface DispatchOutput {
    readonly handled: boolean;
    readonly sent: Array<{target: string; text: string}>;
    readonly persisted: boolean;
    readonly version: number | null;
}

const turnToText = (turn: Turn | undefined): string | null => {
    if (!turn) return null;
    switch (turn.kind) {
        case 'response': return turn.text;
        case 'tool_calls': return `[cycle: ${turn.calls.length} tool call(s) — ${turn.calls.map(c => c.name).join(', ')}]`;
        case 'internal': return null;
    }
};

const safeOriginDir = (stateDir: string, origin: string): string =>
    join(stateDir, encodeURIComponent(origin));

const getOrCreateState = async (store: DispatchState, origin: string): Promise<State> => {
    const cached = store.states.get(origin);
    if (cached) return cached;
    const dir = safeOriginDir(store.stateDir, origin);
    const snapshots = await listSnapshots(dir);
    const state = snapshots.at(-1)?.state ?? initialState();
    store.states.set(origin, state);
    const journal = new StateJournal();
    for (const snap of snapshots) {
        journal.record(snap.state, snap.turns, snap.state.attention, snap.timestamp);
    }
    store.journals.set(origin, journal);
    return state;
};

const getJournal = (store: DispatchState, origin: string): StateJournal => {
    let j = store.journals.get(origin);
    if (!j) {
        j = new StateJournal();
        store.journals.set(origin, j);
    }
    return j;
};

const messageToFocus = (input: DispatchInput): Focus => ({
    kind: 'message',
    source: input.connectionId,
    sender: input.sender,
    text: input.text,
    origin: input.origin,
    receivedAt: input.timestamp,
});

const buildDeps = (input: DispatchInput, agent?: unknown): CycleDeps => {
    if (input.deps) return input.deps;
    return {
        reasoner: episodeReasoner({agent: agent as never, ctx: input.episodeCtx ?? {}}),
        validator: patternValidator(),
    };
};

const operatorCtxFor = (
    store: DispatchState,
    origin: string,
    deps: CycleDeps,
    stateDir?: string,
    ctxOrigin?: string,
    setState?: (s: State) => void,
): OperatorContext => ({
    journal: getJournal(store, origin),
    currentState: () => store.states.get(origin) ?? initialState(),
    currentTurns: () => getJournal(store, origin).latest()?.turns ?? [],
    deps,
    ...(stateDir !== undefined ? {stateDir} : {}),
    ...(ctxOrigin !== undefined ? {origin: ctxOrigin} : {}),
    ...(setState !== undefined ? {setState} : {}),
});

export interface DispatchOptions {
    readonly store: DispatchState;
    readonly send: (target: string, text: string) => Promise<void> | void;
    readonly resolveTarget?: (input: DispatchInput) => string;
    readonly agent?: unknown;
    readonly deps?: CycleDeps;
    readonly maxSnapshots?: number;
}

export const dispatchCycleMessage = async (
    input: DispatchInput,
    opts: DispatchOptions,
): Promise<DispatchOutput> => {
    const queueKey = input.origin;
    const queues = opts.store.queues;
    if (queues) {
        const prev = queues.get(queueKey) ?? Promise.resolve();
        const next = prev.then(() => runDispatch(input, opts));
        queues.set(queueKey, next);
        try {
            return await next;
        } finally {
            if (queues.get(queueKey) === next) queues.delete(queueKey);
        }
    }
    return runDispatch(input, opts);
};

const runDispatch = async (
    input: DispatchInput,
    opts: DispatchOptions,
): Promise<DispatchOutput> => {
    const sent: Array<{target: string; text: string}> = [];
    const resolveTarget = opts.resolveTarget ?? ((i: DispatchInput) => i.sender);
    const deps = buildDeps(input, opts.agent);

    if (input.text.startsWith('!')) {
        await getOrCreateState(opts.store, input.origin);
        const result = await runOperatorCommand(input.text, operatorCtxFor(opts.store, input.origin, deps, opts.store.stateDir, input.origin, (s) => {
            opts.store.states.set(input.origin, s);
        }));
        if (result.handled) {
            const target = resolveTarget(input);
            await opts.send(target, result.text);
            sent.push({target, text: result.text});
        }
        const version = opts.store.states.get(input.origin)?.version ?? null;
        return {handled: result.handled, sent, persisted: false, version};
    }

    const state = await getOrCreateState(opts.store, input.origin);
    const focus = messageToFocus(input);
    const {state: nextState, turns} = await cycle(focus, state, deps);
    opts.store.states.set(input.origin, nextState);
    getJournal(opts.store, input.origin).record(nextState, turns, focus);
    const dir = safeOriginDir(opts.store.stateDir, input.origin);
    await snapshotState(nextState, turns, dir);
    if (opts.maxSnapshots !== undefined) {
        await enforceRetention(dir, opts.maxSnapshots);
    }

    const text = turnToText(turns[0]);
    if (text) {
        const target = resolveTarget(input);
        await opts.send(target, text);
        sent.push({target, text});
    }
    return {handled: true, sent, persisted: true, version: nextState.version};
};
