import type { DerivationRecord, ReasoningBudget } from '@senars/schemas';
import type { TermTruth } from '../types/truth';
import { type Game, type GameOutcome } from '../game/Game';
import type { GateRegistry } from '../kernel/index';
import type { ConfidenceRouter } from '../lm/system-one/policy';
import type { EmbeddingCache, JudgmentManifold } from '../lm/system-one/types';
import { type IProposer, type NALDerivation, type NegotiationDecision } from '../reflex/Negotiator';
import { type Reflex } from '../reflex/Reflex';
import type { NarEventBus } from '../types/events';
import { type SeededBelief } from './belief-seeding';
import { type PromotedSchema } from './episode-schemas';
import { Focus, type FocusOptions } from './Focus';
export interface GameFocusOptions {
    focusId: string;
    game: Game;
    focusOptions?: Partial<FocusOptions>;
    /** E2: review-band escalation to the game's heuristic baseline (search handover). */
    handover?: {
        router: ConfidenceRouter;
        reviewAction?: 'escalate-baseline' | 'abstain' | 'act';
        minBaselineConfidence?: number;
        baseline: (game: Game, legalActions: string[]) => string | null;
    };
    /** E7 cognitive mode: per-tick thought-stream panel entries + veto justification records. */
    cognitive?: boolean;
    /** G2: promote per-action reward patterns into advisory focus beliefs at episode end. */
    schemaInduction?: boolean;
    /** TODO19 F2: per-instance gate registry (defaults to the process-global singleton). */
    gateRegistry: GateRegistry;
    /** Phase C (REFACTOR.todo3): extra negotiation proposers (e.g. MettaProposer) + bus for contradiction events. */
    proposers?: IProposer[];
    eventBus?: NarEventBus;
}
/** E7: per-tick cognition snapshot for the thought-stream panel. */
export interface TickPanelEntry {
    cycle: number;
    proposalActions: string[];
    nalDerivations: NALDerivation[];
    decision: NegotiationDecision;
    handover: boolean;
    reward: number;
    terminal: boolean;
    focusWeight: number;
}
/** Components needed to prefetch semantic reflex judgments at the attend stage (C1). */
export interface ReflexPrefetchContext {
    manifold: JudgmentManifold;
    embeddingCache: EmbeddingCache;
    budget: ReasoningBudget;
}
/** The GameFocus surface the System One / LM reflex binders need — one place to change. */
export type ReflexBindable = Pick<GameFocus, 'bindReflex'> & Partial<Pick<GameFocus, 'setReflexPrefetchContext'>>;
export declare class GameFocus {
    #private;
    readonly focus: Focus;
    readonly game: Game;
    private readonly negotiator;
    private readonly handover;
    private readonly cognitive;
    private readonly schemaInduction;
    private readonly clock;
    private readonly panelLog;
    private readonly vetoJustifications;
    private episodeHistory;
    private promotedSchemas;
    private handoverCount;
    private lastTickHandover;
    private cycle;
    private previousPerception;
    private vetoCount;
    private vetoDetails;
    private episodeVetoCounts;
    private currentEpisodeVetos;
    private readonly gates;
    constructor(options: GameFocusOptions);
    private logGameTrace;
    /** Refresh this focus's scoped autonomy + allowlist from the current legal actions. */
    private syncScope;
    /** Drop this focus's scoped gate entries (lifecycle hygiene, A4). */
    releaseScope(): void;
    bindReflex(reflex: Reflex): void;
    /** E7: seed a rule belief `(action ==> consequence)` into the focus's task bag. */
    seedRule(action: string, consequence: string, truth: TermTruth, priority?: number): void;
    /** E7: seed a raw Narsese belief (Self-Concept-Vocabulary pattern). */
    seedBelief(belief: SeededBelief): void;
    /** E7: per-tick cognition snapshots (cognitive mode only). */
    getPanelLog(): readonly TickPanelEntry[];
    /** E7: recorder-verifiable justification record for every NAL veto. */
    getVetoJustifications(): readonly DerivationRecord[];
    private recordPanel;
    /** E7: build a DerivationRecord for a veto from the matched NAL derivation. */
    private buildVetoJustification;
    private reflexPrefetchContext;
    private prefetchCalls;
    /** Wire manifold components so semantic reflexes prefetch at the attend stage (C1). */
    setReflexPrefetchContext(context: ReflexPrefetchContext | null): void;
    getPrefetchCallCount(): number;
    private prefetchForReflexes;
    private gameTraceEnabled;
    private initGameTrace;
    step(budget: number): Promise<{
        focusReport: any;
        gameOutcome: GameOutcome | null;
    }>;
    /** Shared per-tick state threaded through the stage methods (G1). */
    private tickState;
    /** BUDGET: renew the per-focus scope and check the `nal-step` budget. */
    private beginTick;
    /** PERCEPTION: the Focus step admits game observations as tasks, then ATTEND prefetch (C1). */
    private perceiveStage;
    /** ATTEND: prefetch semantic reflex judgments before the synchronous propose contract (C1). */
    private attendStage;
    /** PROPOSAL: collect from every bound reflex and merge best-of (A2). Returns false when no reflex proposed. */
    private proposeStage;
    /** NEGOTIATION: NAL derivations, resolution, and the E2 handover (may yield the tick). */
    private negotiateStage;
    /** AUTHORIZE/ACT/VALIDATE: kernel gate → world mutation → reward firewall. */
    private actStage;
    /** LEARN: fan learning events to every proposing reflex; trace + panel close the tick. */
    private learnStage;
    /** G2: promote the episode's worst/best action patterns into advisory beliefs. */
    private consolidateEpisode;
    /** G2: schemas promoted so far (advisory beliefs the Negotiator weighs next episode). */
    getPromotedSchemas(): readonly PromotedSchema[];
    /** Veto bookkeeping (2C) — counters, details, and the E7 justification record. */
    private trackVeto;
    private panelEntry;
    /** PANEL/consolidate: thought-stream entry + perception advance for completed ticks. */
    private endTick;
    getFocus(): Focus;
    getGame(): Game;
    getCycle(): number;
    /** E2 handover telemetry. */
    getHandoverCount(): number;
    didLastTickHandover(): boolean;
    /** Call at the end of each episode to track veto rate (2C). */
    markEpisodeEnd(): void;
    /** Get veto statistics (2C). */
    getVetoStats(): {
        totalVetos: number;
        episodeVetoCounts: number[];
        vetoRate: number;
        vetoDetails: Array<{
            cycle: number;
            action: string;
            vetoReason: string;
            derivation: {
                action: string;
                truth: TermTruth;
                source: string;
            };
        }>;
    };
    /** Reset veto tracking for a new run. */
    resetVetoTracking(): void;
    private parseAction;
}
export declare function createGameFocus(options: GameFocusOptions): GameFocus;
//# sourceMappingURL=GameFocus.d.ts.map