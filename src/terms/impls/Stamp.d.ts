import { type Timestamp } from '../../types/primitives';
/**
 * Advance the ID counter past a persisted ID so reloaded stamps never collide
 * with newly minted ones. No-op for foreign ID formats. CAS loop keeps it
 * correct even if another thread mints concurrently.
 */
export declare const observeStampId: (id: string) => void;
export interface SerializedStamp {
    id: string;
    creationTime: number;
    source: Source;
    derivations: readonly string[];
}
export declare const serializeStamp: (stamp: Stamp) => SerializedStamp;
export declare const deserializeStamp: (data: SerializedStamp) => Stamp;
export type Source = 'INPUT' | 'DERIVED' | 'CONSTITUTION' | 'LM' | 'EXTERNAL_MCP';
export interface Stamp {
    readonly id: string;
    readonly creationTime: Timestamp;
    readonly source: Source;
    readonly derivations: readonly string[];
}
export declare const Stamp: {
    createInput(id?: string): Stamp;
    createWithSource(source: Source): Stamp;
    derive(parentStamps: readonly Stamp[], source?: Source): Stamp | undefined;
    getDepth: (stamp: Stamp) => number;
    /**
     * Every ancestor `stamp` records, root-most first, with the stamp itself last.
     *
     * The one reading of "how was this claim reached", because `derivations` *is*
     * the ancestor set: there is no parent pointer to walk, so a path had to be
     * reconstructed from a side index or quietly collapse to the stamp alone.
     */
    lineage: (stamp: Stamp | undefined) => string[];
    getMaxDepth: (stamps: readonly Stamp[]) => number;
    canDerive: (stamps: readonly Stamp[]) => boolean;
    overlaps: (a: Stamp, b: Stamp) => boolean;
};
//# sourceMappingURL=Stamp.d.ts.map