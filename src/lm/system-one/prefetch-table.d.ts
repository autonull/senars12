/**
 * The cold judgment table every manifold-backed reflex serves from: prefetched
 * during the attend stage of a cycle, consumed once at propose, with the
 * incumbent reflex covering whatever the table did not score.
 */
import type { Perception } from '../../game/Game';
import type { ActionProposal, Reflex } from '../../reflex/Reflex';
export declare class PrefetchTable<Row> {
    #private;
    /** A tick the manifold abstained on everywhere leaves the table cold. */
    set(stateId: string, rows: Map<string, Row>): void;
    /** Consume-once: a judgment resolved for one tick must never serve another. */
    take(stateId: string): Map<string, Row> | undefined;
    get size(): number;
}
export interface PrefetchPropose<Row> {
    readonly id: string;
    readonly table: PrefetchTable<Row>;
    readonly fallback: Reflex<unknown, unknown>;
    readonly state: Perception;
    readonly legalActions: string[];
    /** Row → proposal. A missing row falls through to the incumbent proposal. */
    readonly toProposal: (action: string, row: Row) => ActionProposal;
}
/**
 * Serve one tick from the prefetched table, filling every action the table did
 * not score from the incumbent reflex.
 *
 * Shared by all manifold-backed reflexes so that action identity is decided
 * once: a numeric action `0` must reach the pipeline as `"0"`, never as a
 * falsy value that the negotiation/act path would drop.
 */
export declare function proposeFromTable<Row>({ id, table, fallback, state, legalActions, toProposal, }: PrefetchPropose<Row>): ActionProposal[];
//# sourceMappingURL=prefetch-table.d.ts.map