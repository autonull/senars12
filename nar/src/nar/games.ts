import type { ReasoningBudget } from '@senars/kernel/schemas';
import { FocusBag } from '../focus/FocusBag.js';
import { GameFocus, type GameFocusOptions } from '../focus/GameFocus.js';
import { createSelfMetaGame, type SelfMetaGameImpl } from '../game/SelfMetaGame.js';
import type { EmbeddingCache } from '../lm/system-one/embedding-cache.js';
import type { JudgmentManifold } from '../lm/system-one/types.js';
import type { Reflex } from '../reflex/Reflex.js';
import type { RandomSource } from '../types/primitives.js';
import type { SystemOneRuntime } from './system-one.js';
import { ConversationGame, type ConversationState, type ConversationAction } from '../game/ConversationGame.js';

/**
 * Game/attachment registry (extracted from NAR — M2): owns attached GameFocus
 * instances, the default FocusBag, and the self-meta-game.
 */
export class GameManager {
  private readonly attachedGames = new Map<string, { focus: GameFocus; bag: FocusBag }>();
  private gameFocusBag: FocusBag | null = null;
  private metaGame: SelfMetaGameImpl | null = null;
  private readonly metaGameFocuses = new Map<string, GameFocus>();

  constructor(
    private readonly systemOne: SystemOneRuntime,
    private readonly rng?: RandomSource
  ) {}

  /** Default FocusBag backing attachGame (created lazily, script-owned drive loops). */
  getFocusBag(): FocusBag {
    this.gameFocusBag ??= new FocusBag({ capacity: 32, rng: this.rng });
    return this.gameFocusBag;
  }

  /**
   * Register a game with the kernel (TODO17 A4): creates a scoped-gate GameFocus,
   * binds the supplied reflexes (plus a ManifoldReflex when System One is enabled),
   * wires the prefetch context, and inserts the focus into a FocusBag.
   */
  attachGame(
    game: GameFocusOptions['game'],
    options: {
      id?: string;
      reflexes?: Reflex[];
      weight?: number;
      focusBag?: FocusBag;
      /** Bind an LMReflex (real-LM per-tick decisions) in addition to the manifold arm. */
      lmReflex?: boolean;
    } = {}
  ): GameFocus {
    const bag = options.focusBag ?? this.getFocusBag();
    const id = options.id ?? `game-${game.constructor.name}-${bag.getFocusWeights().size}`;
    const focus = new GameFocus({
      focusId: id,
      game,
      focusOptions: { weight: options.weight ?? 1.0, rng: this.rng },
    });
    for (const reflex of options.reflexes ?? []) focus.bindReflex(reflex);
    if (this.systemOne.enabled) this.systemOne.attachManifoldReflex(focus);
    if (options.lmReflex && this.systemOne.enabled) this.systemOne.attachLMReflex(focus);
    bag.add(focus.focus);
    this.attachedGames.set(id, { focus, bag });
    this.metaGameFocuses.set(id, focus);
    return focus;
  }

  /** Remove a game's focus from the bag and drop its scoped gates (no residue). */
  detachGame(id: string): boolean {
    const entry = this.attachedGames.get(id);
    if (!entry) return false;
    entry.bag.remove(id);
    entry.focus.releaseScope();
    this.attachedGames.delete(id);
    this.metaGameFocuses.delete(id);
    return true;
  }

  getAttachedGames(): string[] {
    return [...this.attachedGames.keys()];
  }

  /**
   * Self-meta-game over the attached games (TODO17b D20): lazily created so
   * focus step reports (via FocusSchedulerOptions.metaGame) route self-improvement
   * proposals through the governance pipeline.
   */
  getSelfMetaGame(): SelfMetaGameImpl {
    this.metaGame ??= createSelfMetaGame({
      id: 'nar-self-meta-game',
      observesFocuses: [...this.attachedGames.keys()],
      focusBag: this.getFocusBag(),
      gameFocuses: this.metaGameFocuses,
    });
    return this.metaGame;
  }

  /**
   * Attach a ConversationGameFocus for the bot's conversation loop.
   * Returns the created focus and the ConversationGame instance.
   */
  attachConversationGame(
    options: {
      id?: string;
      reflexes?: Reflex[];
      weight?: number;
      focusBag?: FocusBag;
      lmReflex?: boolean;
    } = {}
  ): { focus: GameFocus; game: ConversationGame } {
    const bag = options.focusBag ?? this.getFocusBag();
    const id = options.id ?? 'conversation';
    const game = new ConversationGame();
    const focus = new GameFocus({
      focusId: id,
      game,
      focusOptions: { weight: options.weight ?? 1.0, rng: this.rng },
    });
    for (const reflex of options.reflexes ?? []) focus.bindReflex(reflex);
    if (this.systemOne.enabled) this.systemOne.attachManifoldReflex(focus);
    if (options.lmReflex && this.systemOne.enabled) this.systemOne.attachLMReflex(focus);
    bag.add(focus.focus);
    this.attachedGames.set(id, { focus, bag });
    this.metaGameFocuses.set(id, focus);
    return { focus, game };
  }
}

/** Prefetch context shape shared by reflex attach points (re-exported for parity). */
export type ReflexPrefetchContext = {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  budget: ReasoningBudget;
};
