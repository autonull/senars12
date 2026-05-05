export type Stamp = {
    readonly id: string;
    readonly creationTime: number;
    readonly source: Source;
    readonly derivations: readonly string[];
    readonly depth: number;
};

export type Source = 'INPUT' | 'DERIVED';

const MAX_DEPTH = 10;

function makeId(): string {
    return crypto.randomUUID();
}

export const Stamp = {
    createInput(): Stamp {
        return Object.freeze({
            id: makeId(),
            creationTime: Date.now(),
            source: 'INPUT',
            derivations: [],
            depth: 0
        });
    },

    derive(parentStamps: readonly Stamp[], source: Source = 'DERIVED'): Stamp | undefined {
        const maxDepth = parentStamps.reduce((max, s) => Math.max(max, s.depth), 0);
        if (maxDepth >= MAX_DEPTH) return undefined;

        const allDerivations = parentStamps.flatMap(s => [s.id, ...s.derivations]);
        const unique = [...new Set(allDerivations)];

        return Object.freeze({
            id: makeId(),
            creationTime: Date.now(),
            source,
            derivations: unique,
            depth: maxDepth + 1
        });
    },

    getDepth(stamp: Stamp): number {
        return stamp.depth;
    },

    getMaxDepth(stamps: readonly Stamp[]): number {
        return stamps.reduce((max, s) => Math.max(max, s.depth), 0);
    },

    canDerive(stamps: readonly Stamp[]): boolean {
        return Stamp.getMaxDepth(stamps) < MAX_DEPTH;
    }
};

export { MAX_DEPTH };

export function getStampId(stamp: Stamp): string {
    return stamp.id;
}

export function getStampSource(stamp: Stamp): Source {
    return stamp.source;
}