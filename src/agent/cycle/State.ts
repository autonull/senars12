export interface Truth {
    readonly f: number;
    readonly c: number;
}

export interface Belief {
    readonly term: string;
    readonly truth: Truth;
    readonly priority: number;
}

export interface Episode {
    readonly id: string;
    readonly timestamp: number;
    readonly input: string;
    readonly response: string;
    readonly tags: readonly string[];
}

export interface Identity {
    readonly beliefs: readonly Belief[];
    readonly skills: readonly string[];
    readonly goals: readonly string[];
    readonly version: number;
}

export interface Goal {
    readonly id: string;
    readonly statement: string;
    readonly priority: number;
    readonly status: 'pending' | 'pursuing' | 'completed' | 'failed';
}

export interface Focus {
    readonly kind: 'message';
    readonly source: string;
    readonly sender: string;
    readonly text: string;
    readonly origin: string;
    readonly receivedAt: number;
}

export interface Budget {
    readonly tokensRemaining: number;
    readonly stepsRemaining: number;
    readonly deadline: number;
    readonly maxOutputTokens: number;
}

export interface State {
    readonly attention: Focus | null;
    readonly beliefs: readonly Belief[];
    readonly episodes: readonly Episode[];
    readonly identity: Readonly<Identity>;
    readonly goals: readonly Goal[];
    readonly budget: Budget;
    readonly version: number;
    readonly prev: State | null;
    readonly interrupted: boolean;
}

export const initialState = (overrides: Partial<State> = {}): State => ({
    attention: null,
    beliefs: [],
    episodes: [],
    identity: {beliefs: [], skills: [], goals: [], version: 0},
    goals: [],
    budget: {tokensRemaining: 1000, stepsRemaining: 10, deadline: Date.now() + 60000, maxOutputTokens: 256},
    version: 0,
    prev: null,
    interrupted: false,
    ...overrides,
});

export const withAttention = (s: State, focus: Focus | null): State => ({
    ...s,
    attention: focus,
    interrupted: false,
});

export const interrupt = (s: State): State => ({...s, interrupted: true});
