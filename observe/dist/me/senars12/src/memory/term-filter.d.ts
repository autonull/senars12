/** Shared case-insensitive term-substring matching (concepts, beliefs, goals). */
export interface TermBearing {
    readonly term: {
        toString(): string;
    };
}
export declare const termMatches: (candidate: TermBearing, lowerPattern: string) => boolean;
/** Filter `items` whose term contains `pattern`, stopping at `limit` matches. */
export declare const filterByTerm: <T extends TermBearing>(items: Iterable<T>, pattern: string, limit?: number) => T[];
//# sourceMappingURL=term-filter.d.ts.map