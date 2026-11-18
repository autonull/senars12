/**
 * The cold judgment table every manifold-backed reflex serves from: prefetched
 * during the attend stage of a cycle, consumed once at propose, with the
 * incumbent reflex covering whatever the table did not score.
 */

import { indexBy } from '@senars/util';
import type { Perception } from '../../game/Game.js';
import type { ActionProposal, Reflex } from '../../reflex/Reflex.js';

export class PrefetchTable<Row> {
  readonly #rows = new Map<string, Map<string, Row>>();

  /** A tick the manifold abstained on everywhere leaves the table cold. */
  set(stateId: string, rows: Map<string, Row>): void {
    if (rows.size > 0) this.#rows.set(stateId, rows);
  }

  /** Consume-once: a judgment resolved for one tick must never serve another. */
  take(stateId: string): Map<string, Row> | undefined {
    const rows = this.#rows.get(stateId);
    if (rows) this.#rows.delete(stateId);
    return rows;
  }

  get size(): number {
    return this.#rows.size;
  }
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
export function proposeFromTable<Row>({
  id,
  table,
  fallback,
  state,
  legalActions,
  toProposal,
}: PrefetchPropose<Row>): ActionProposal[] {
  const rows = table.take(state.stateId);
  if (!rows) return fallback.propose(state, legalActions) as ActionProposal[];

  const fallbackProposals =
    rows.size < legalActions.length
      ? (fallback.propose(state, legalActions) as ActionProposal[])
      : [];
  const byAction = indexBy(fallbackProposals, (p) => String(p.action));

  const proposals: ActionProposal[] = [];
  for (const legal of legalActions) {
    const action = String(legal);
    const row = rows.get(action);
    const incumbent = byAction.get(action);
    if (row !== undefined) proposals.push(toProposal(action, row));
    else if (incumbent) proposals.push({ ...incumbent, action: String(incumbent.action) });
  }
  return proposals;
}
