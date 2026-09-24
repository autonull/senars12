import { createHash } from 'node:crypto';
import type { Episode, EpisodicMemory, EpisodeType } from '@senars/util';
import type { ContrastiveMemory } from '../lm/system-one/contrastive.js';
import type { JudgmentDataset } from '../lm/system-one/distill.js';
import type { EmbeddingCache } from '../lm/system-one/types.js';
import { recordReactionLabel } from '../lm/system-one/label-sources.js';
import type { DialogueTurn, Reaction, ReactionKind } from './types.js';
import type { DialogueConfig } from '@senars/util/config';

export const sha256 = (text: string): string =>
  `sha256:${createHash('sha256').update(text).digest('hex')}`;

/**
 * Injected, all-optional deps: dialogue is a peer subsystem that optional
 * reasoners (System One) feed into. With none wired, capture still records
 * episodes; label/contrastive fan-out degrades gracefully.
 */
export interface DialogueCaptureDeps {
  dataset?: JudgmentDataset;
  embeddingCache?: EmbeddingCache;
  episodic?: EpisodicMemory;
  contrastive?: ContrastiveMemory;
  /** TODO24 Phase-B enrichment: populate judgment/provenance/reflex per turn (best-effort). */
  enrich?: (input: ExchangeInput, turn: DialogueTurn) => Promise<Partial<DialogueTurn>>;
  config?: Partial<DialogueConfig>;
}

export interface ExchangeInput {
  correlationId: string;
  utterance: string;
  response: string;
  grounding?: { admitted: boolean; score: number };
  judgment?: { abstained: boolean; band: string };
  reflex?: { proposed: readonly string[]; selected: string; vetoes: number };
  provenance?: DialogueTurn['provenance'];
}

/**
 * TODO24: the single fan-out point of the Dialogue Flywheel. One instance per
 * bot; every chat surface routes through onExchange, reactions bind
 * retroactively via bindReaction. Every sink is guarded by `enabled` (I5) and
 * best-effort — failures never disrupt chat. Hash-only at rest (I6); sessions
 * join on the existing correlationId (I7).
 */
export class DialogueCapture {
  readonly #config: DialogueConfig;
  readonly #deps: DialogueCaptureDeps;
  /** turnId → turn (in-memory reaction-join window); bounded per AIKR. */
  #turns = new Map<string, DialogueTurn>();
  /** correlationId → session identity (I7): first correlationId + turn seq. */
  #sessions = new Map<string, { first: string; seq: number }>();
  /** Bound turnIds, for idempotent fan-out (Bench 72). */
  #bound = new Set<string>();

  constructor(deps: DialogueCaptureDeps = {}) {
    const { enabled = false, captureAll = false, maxTurnsPerSession = 500 } = deps.config ?? {};
    this.#config = { enabled, captureAll, maxTurnsPerSession, autoRetrospect: deps.config?.autoRetrospect === true };
    this.#deps = deps;
  }

  get enabled(): boolean {
    return this.#config.enabled;
  }

  get config(): DialogueConfig {
    return { ...this.#config };
  }

  /** Capture one exchange; returns the turnId, or undefined when disabled/capped. */
  async onExchange(input: ExchangeInput): Promise<string | undefined> {
    if (!this.#config.enabled) return undefined;

    const session = this.#sessions.get(input.correlationId) ?? {
      first: input.correlationId,
      seq: 0,
    };
    if (session.seq >= this.#config.maxTurnsPerSession) return undefined;
    session.seq += 1;
    this.#sessions.set(input.correlationId, session);

    const turnId = `${input.correlationId}:${session.seq}`;
    const turn: DialogueTurn = {
      sessionId: session.first,
      turnId,
      seq: session.seq,
      ...(input.utterance.trim() ? { utteranceDigest: sha256(input.utterance) } : {}),
      ...(input.response.trim() ? { responseDigest: sha256(input.response) } : {}),
      ...(input.grounding ? { grounding: input.grounding } : {}),
      ...(input.judgment ? { judgment: input.judgment } : {}),
      ...(input.reflex ? { reflex: input.reflex } : {}),
      ...(input.provenance ? { provenance: input.provenance } : {}),
    };
    // Best-effort enrichment (Phase B): failures degrade to the base turn.
    if (this.#deps.enrich) {
      try {
        Object.assign(turn, await this.#deps.enrich(input, turn));
      } catch {
        // enrichment is optional — never blocks capture
      }
    }
    this.#turns.set(turnId, turn);

    // Persist hash-only episode (event-sourced; reactions join at read time).
    await this.#deps.episodic
      ?.log(
        'dialogue',
        JSON.stringify({
          turnId,
          sessionId: turn.sessionId,
          seq: turn.seq,
          utteranceDigest: turn.utteranceDigest,
          responseDigest: turn.responseDigest,
          grounding: turn.grounding,
        }),
        { correlationId: input.correlationId, sessionId: turn.sessionId, turnId }
      )
      .catch(() => {});
    return turnId;
  }

  /** Latest captured turn, for retroactive `.react` binding. */
  latestTurn(): DialogueTurn | undefined {
    const last = [...this.#turns.keys()].pop();
    return last ? this.#turns.get(last) : undefined;
  }

  getTurn(turnId: string): DialogueTurn | undefined {
    return this.#turns.get(turnId);
  }

  /**
   * Explicit, retroactive reaction binding (DQ2: no heuristic attribution).
   * Idempotent per (sessionId, turnId). Fan-out: label rows → dataset,
   * contrastive hard negative, reaction episode. Binding to a missing turn is
   * a no-op — never a synthetic turn.
   */
  async bindReaction(turnId: string, kind: ReactionKind, correctionText?: string): Promise<void> {
    if (!this.#config.enabled || this.#bound.has(turnId)) return;
    const turn = this.#turns.get(turnId);
    if (!turn) return;
    this.#bound.add(turnId);

    const reaction: Reaction = {
      kind,
      turnId,
      at: Date.now(),
      ...(correctionText?.trim() ? { correctionDigest: sha256(correctionText) } : {}),
    };
    turn.reaction = reaction;

    // Embed at bind time, then discard (I6/DQ7: fresh per bind).
    const { embeddingCache, dataset, contrastive } = this.#deps;
    let correctionEmbedding: Float32Array | undefined;
    let responseEmbedding: Float32Array | undefined;
    if (embeddingCache && kind !== 'clarify' && kind !== 'redirect') {
      if (correctionText?.trim()) {
        const pointer = await embeddingCache.write(correctionText).catch(() => undefined);
        correctionEmbedding = pointer ? embeddingCache.read(pointer) : undefined;
      }
      if (turn.responseDigest) {
        const pointer = await embeddingCache.write(turn.responseDigest).catch(() => undefined);
        responseEmbedding = pointer ? embeddingCache.read(pointer) : undefined;
      }
    }

    if (dataset) {
      recordReactionLabel(dataset, {
        turnId,
        kind,
        responseDigest: turn.responseDigest ?? '',
        correctionDigest: reaction.correctionDigest,
        responseEmbedding,
        correctionEmbedding,
      });
    }
    // Corrections are hard negatives for the CLM contrastive memory.
    if (contrastive && correctionEmbedding) {
      contrastive.addEmbeddings('groundedness', { negatives: [correctionEmbedding] });
    }

    await this.#deps.episodic
      ?.log(
        'reaction',
        JSON.stringify({
          turnId,
          kind,
          correctionDigest: reaction.correctionDigest,
          hasCorrectionEmbedding: correctionEmbedding !== undefined,
        }),
        { correlationId: turn.sessionId, sessionId: turn.sessionId, turnId, kind }
      )
      .catch(() => {});
  }
}