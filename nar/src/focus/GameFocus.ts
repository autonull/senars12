import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DerivationRecord } from '@senars/kernel/schemas';
import { PriorityBag } from '../bag/Bag.js';
import type { Game, GameOutcome, Perception } from '../game/Game.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { EmbeddingCache, JudgmentManifold } from '../lm/system-one/types.js';
import { gateRegistry } from '../kernel/index.js';
import { type NALDerivation, NegotiationDecision, Negotiator } from '../reflex/Negotiator.js';
import { ActionProposal, LearningEvent, type Reflex } from '../reflex/Reflex.js';
import { ConfidenceRouter } from '../lm/system-one/policy.js';
import { Focus, type FocusOptions } from './Focus.js';
import { actionRuleBelief, seedBelief, type SeededBelief } from './belief-seeding.js';
import { induceEpisodeSchemas, type PromotedSchema } from './schema-induction.js';

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

/** G1: per-tick state threaded through the named step stages. */
interface TickState {
  focusReport: any;
  reflexProposals: Array<{ reflex: Reflex; proposals: ActionProposal[] }>;
  proposals: ActionProposal[];
  proposalActions: string[];
  nalDerivations: NALDerivation[];
  bestReflexProposal: ActionProposal | null;
  decision: NegotiationDecision;
  legalActions: Array<string | number>;
  prevWeight: number;
  deliveringReflexes: Set<Reflex>;
  gameOutcome: GameOutcome | null;
  /** Review-band yield (block/abstain): panel recorded, tick ends early. */
  yielded: boolean;
  /** Kernel-gate or firewall denial: panel + perception advance suppressed. */
  suppressPanel: boolean;
  /** True once any reflex proposed this tick (gates panel recording). */
  proposed: boolean;
  perceptionPair: { previousPerception: Perception; nextPerception: Perception } | null;
}

/** Components needed to prefetch semantic reflex judgments at the attend stage (C1). */
export interface ReflexPrefetchContext {
  manifold: JudgmentManifold;
  embeddingCache: EmbeddingCache;
  budget: ReasoningBudget;
}

export class GameFocus {
  readonly focus: Focus;
  readonly game: Game;
  private readonly negotiator: Negotiator;
  private readonly handover: GameFocusOptions['handover'];
  private readonly cognitive: boolean;
  private readonly schemaInduction: boolean;
  private panelLog: TickPanelEntry[] = [];
  private vetoJustifications: DerivationRecord[] = [];
  private episodeHistory: Array<{ action: string; reward: number }> = [];
  private promotedSchemas: PromotedSchema[] = [];
  private handoverCount = 0;
  private lastTickHandover = false;
  private cycle = 0;
  private previousPerception: Perception | null = null;

  // Veto tracking (2C)
  private vetoCount = 0;
  private vetoDetails: Array<{
    cycle: number;
    action: string;
    vetoReason: string;
    derivation: { action: string; truth: { f: number; c: number }; source: string };
  }> = [];
  private episodeVetoCounts: number[] = [];
  private currentEpisodeVetos = 0;

  constructor(options: GameFocusOptions) {
    this.game = options.game;
    this.handover = options.handover;
    this.cognitive = options.cognitive ?? false;
    this.schemaInduction = options.schemaInduction ?? false;

    this.focus = new Focus({
      id: options.focusId,
      taskCapacity: options.focusOptions?.taskCapacity ?? 1000,
      conceptCapacity: options.focusOptions?.conceptCapacity ?? 500,
      weight: options.focusOptions?.weight ?? 1.0,
    });

    this.negotiator = new Negotiator({ nalVetoThreshold: 0.8, reflexThreshold: -1 });

    this.focus.bindGame(this.game);

    // Sandboxed game worlds: grant the focus's own scope sandbox-execute autonomy
    // and allow its legal actions through the kernel ActionGate. The global
    // autonomy mode and shared allowlist are untouched (A3 scoped gates).
    this.syncScope();

    this.initGameTrace();
  }

  /** Refresh this focus's scoped autonomy + allowlist from the current legal actions. */
  private syncScope(): void {
    const actionGate = gateRegistry.getActionGate();
    actionGate.removeScope(this.focus.id);
    actionGate.setScopeAutonomy(this.focus.id, 'sandbox-execute');
    for (const a of this.game.legalActions(this.game.state()))
      actionGate.addScopedOperation(this.focus.id, String(a));
  }

  /** Drop this focus's scoped gate entries (lifecycle hygiene, A4). */
  releaseScope(): void {
    gateRegistry.getActionGate().removeScope(this.focus.id);
    gateRegistry.getBudgetGate().releaseScope(this.focus.id);
  }

  bindReflex(reflex: Reflex): void {
    this.focus.bindReflex(reflex);
  }

  /** E7: seed a rule belief `(action ==> consequence)` into the focus's task bag. */
  seedRule(action: string, consequence: string, truth: { f: number; c: number }, priority?: number): void {
    seedBelief(this.focus, actionRuleBelief(action, consequence, truth, priority));
  }

  /** E7: seed a raw Narsese belief (Self-Concept-Vocabulary pattern). */
  seedBelief(belief: SeededBelief): void {
    seedBelief(this.focus, belief);
  }

  /** E7: per-tick cognition snapshots (cognitive mode only). */
  getPanelLog(): readonly TickPanelEntry[] {
    return this.panelLog;
  }

  /** E7: recorder-verifiable justification record for every NAL veto. */
  getVetoJustifications(): readonly DerivationRecord[] {
    return this.vetoJustifications;
  }

  private recordPanel(entry: TickPanelEntry): void {
    if (this.cognitive) this.panelLog.push(entry);
  }

  /** E7: build a DerivationRecord for a veto from the matched NAL derivation. */
  private buildVetoJustification(
    cycle: number,
    action: string,
    derivation: NALDerivation
  ): DerivationRecord {
    const premise = derivation.premise ?? action;
    const premiseTruth = { frequency: derivation.truth.f, confidence: derivation.truth.c };
    const stepId = uuidv4();
    const derived = {
      frequency: premiseTruth.frequency * premiseTruth.frequency,
      confidence: premiseTruth.confidence * premiseTruth.confidence,
    };
    return {
      derivationId: uuidv4(),
      taskId: uuidv4(),
      goalTerm: `veto(${action})`,
      steps: [
        {
          stepId,
          ruleId: 'deduction',
          ruleCategory: 'logic',
          premises: [premise, premise],
          conclusion: `veto(${action})`,
          truth: derived,
          premiseTruths: [premiseTruth, premiseTruth],
          evidenceLineage: [],
          independence: 'independent',
        },
      ],
      finalTruth: derived,
      totalCycles: 0,
      maxDepthReached: 0,
      timestamp: Date.now() + cycle,
      engine: 'nar',
    };
  }

  private reflexPrefetchContext: ReflexPrefetchContext | null = null;
  private prefetchCalls = 0;

  /** Wire manifold components so semantic reflexes prefetch at the attend stage (C1). */
  setReflexPrefetchContext(context: ReflexPrefetchContext | null): void {
    this.reflexPrefetchContext = context;
  }

  getPrefetchCallCount(): number {
    return this.prefetchCalls;
  }

  private async prefetchForReflexes(): Promise<void> {
    if (!this.reflexPrefetchContext) return;
    const { manifold, embeddingCache, budget } = this.reflexPrefetchContext;
    const observation = this.game.observe();
    const legalActions = this.game.legalActions(this.game.state()).map(String);
    for (const reflex of this.focus.reflexes) {
      const p = reflex as { prefetch?: unknown };
      if (typeof p.prefetch === 'function') {
        await (
          p.prefetch as (
          stateId: string,
          context: unknown,
          legalActions: string[],
          manifold: JudgmentManifold,
          budget: ReasoningBudget
        ) => Promise<void>
      )(
        observation.stateId,
        await embeddingCache.write(JSON.stringify(observation.features ?? observation.stateId)),
          legalActions,
          manifold,
          budget
        );
        this.prefetchCalls++;
      }
    }
  }

  private gameTraceEnabled = process.env.SENARS_GAME_TRACE === '1';
  private gameTraceLogPath: string | null = null;
  private gameTraceBuffer: string[] = [];
  private gameTraceFlushInterval: ReturnType<typeof setInterval> | null = null;

  private initGameTrace(): void {
    if (!this.gameTraceEnabled) return;
    try {
      const logDir = 'logs';
      mkdirSync(logDir, { recursive: true });
      const date = new Date().toISOString().split('T')[0];
      this.gameTraceLogPath = join(logDir, `game-trace-${date}.jsonl`);
      this.gameTraceFlushInterval = setInterval(() => this.flushGameTrace(), 5000);
      this.gameTraceFlushInterval.unref?.();
    } catch {
      // Silently disable if setup fails
      this.gameTraceEnabled = false;
    }
  }

  private logGameTrace(entry: {
    cycle: number;
    legalActions: number[];
    reflexProposal: ActionProposal | null;
    nalDerivations: NALDerivation[];
    negotiatedAction: NegotiationDecision;
    reward: number;
    terminal: boolean;
    focusWeightDelta: number;
  }): void {
    if (!this.gameTraceEnabled) return;
    this.gameTraceBuffer.push(JSON.stringify({
      ts: Date.now(),
      ...entry,
    }));
  }

  private flushGameTrace(): void {
    if (!this.gameTraceEnabled || this.gameTraceBuffer.length === 0 || !this.gameTraceLogPath) return;
    try {
      appendFileSync(this.gameTraceLogPath, this.gameTraceBuffer.splice(0).join('\n') + '\n', 'utf-8');
    } catch {
      // Silently fail
    }
  }

  async step(budget: number): Promise<{
    focusReport: any;
    gameOutcome: GameOutcome | null;
  }> {
    this.cycle++;
    const gate = this.beginTick();
    if (!gate.granted)
      return { focusReport: { terminated: gate.terminationReason }, gameOutcome: null };

    const t = await this.perceiveStage(budget);
    if (!this.proposeStage(t)) return this.endTick(t);

    this.negotiateStage(t);
    if (!t.yielded) this.actStage(t);
    this.learnStage(t);
    return this.endTick(t);
  }

  /** Shared per-tick state threaded through the stage methods (G1). */
  private tickState(): TickState {
    return {
      focusReport: null,
      reflexProposals: [],
      proposals: [],
      proposalActions: [],
      nalDerivations: [],
      bestReflexProposal: null,
      decision: { action: null, actionExecuted: null, vetoedBy: null, confidence: 0, source: 'none' },
      legalActions: [],
      prevWeight: 0,
      deliveringReflexes: new Set(),
      gameOutcome: null,
      yielded: false,
      suppressPanel: false,
      proposed: false,
      perceptionPair: null,
    };
  }

  /** BUDGET: renew the per-focus scope and check the `nal-step` budget. */
  private beginTick(): { granted: true } | { granted: false; terminationReason: unknown } {
    // Game loops budget per step (the `step(budget)` contract), not per focus
    // lifetime — renew the scope so long-running training isn't starved.
    gateRegistry.getBudgetGate().createScope(this.focus.id);
    const budgetCheck = gateRegistry
      .getBudgetGate()
      .check({ operation: 'nal-step', estimatedCost: 1, scopeId: this.focus.id });
    return budgetCheck.granted
      ? { granted: true }
      : { granted: false, terminationReason: budgetCheck.terminationReason };
  }

  /** PERCEPTION: the Focus step admits game observations as tasks, then ATTEND prefetch (C1). */
  private async perceiveStage(budget: number): Promise<TickState> {
    const t = this.tickState();
    t.focusReport = await this.focus.step(budget);
    await this.attendStage();
    return t;
  }

  /** ATTEND: prefetch semantic reflex judgments before the synchronous propose contract (C1). */
  private async attendStage(): Promise<void> {
    await this.prefetchForReflexes();
  }

  /** PROPOSAL: collect from every bound reflex and merge best-of (A2). Returns false when no reflex proposed. */
  private proposeStage(t: TickState): boolean {
    t.reflexProposals = this.focus.reflexes
      .map((reflex) => ({
        reflex,
        proposals: reflex.propose(this.game.observe(), this.game.legalActions(this.game.state())),
      }))
      .filter((entry) => entry.proposals.length > 0);
    if (t.reflexProposals.length === 0) return false;
    t.proposed = true;

    // Merge per action as max(value × confidence) with per-reflex provenance;
    // over a single reflex the merge is the identity (behavior unchanged).
    const merged = new Map<string, ActionProposal>();
    for (const { proposals } of t.reflexProposals) {
      for (const p of proposals) {
        const incumbent = merged.get(p.action);
        if (!incumbent || p.value * p.confidence > incumbent.value * incumbent.confidence)
          merged.set(p.action, p);
      }
    }
    t.proposals = [...merged.values()];
    t.proposalActions = t.proposals.map((p) => p.action);

    // Convert proposals to goals and add to focus tasks
    const goals = this.focus.getActionGate().toGoals(t.proposals);
    for (const goal of goals) {
      this.focus.tasks.add(goal);
    }
    t.focusReport.gates.actions += goals.length;
    return true;
  }

  /** NEGOTIATION: NAL derivations, resolution, and the E2 handover (may yield the tick). */
  private negotiateStage(t: TickState): void {
    for (const proposal of t.proposals) {
      t.nalDerivations.push(...this.focus.getNALDerivations(proposal.action));
    }
    t.bestReflexProposal = t.proposals.reduce((best, p) =>
      p.value * p.confidence > best.value * best.confidence ? p : best
    );
    const decision = this.negotiator.resolve(t.proposals, t.nalDerivations);

    // HANDOVER (E2): review-band decisions escalate to the heuristic baseline
    // (PlayJev handover pattern); block band yields the tick (AIKR), never a
    // forced bad move.
    this.lastTickHandover = false;
    t.decision = decision;
    if (this.handover && t.decision.actionExecuted) {
      const band = this.handover.router.route({ top: { p: t.decision.confidence } });
      const reviewAction = this.handover.reviewAction ?? 'escalate-baseline';
      if (band === 'block' || (band === 'review' && reviewAction === 'abstain')) {
        this.recordPanel(this.panelEntry(t, false, 0, false));
        t.yielded = true;
        return;
      }
      if (band === 'review') {
        const legal = this.game.legalActions(this.game.state()).map(String);
        const baseline = this.handover.baseline(this.game, legal);
        if (baseline && legal.includes(baseline)) {
          t.decision = { ...t.decision, action: baseline, actionExecuted: baseline, vetoedBy: null };
          this.handoverCount++;
          this.lastTickHandover = true;
        }
      }
    }

    // Legal actions, weight snapshot, and the delivering set for learning fan-out.
    t.legalActions = this.game.legalActions(this.game.state()) as Array<string | number>;
    t.prevWeight = this.focus.weight;
    t.deliveringReflexes =
      t.decision.action != null
        ? new Set(t.reflexProposals.map((entry) => entry.reflex))
        : new Set<Reflex>();
  }

  /** AUTHORIZE/ACT/VALIDATE: kernel gate → world mutation → reward firewall. */
  private actStage(t: TickState): void {
    if (t.decision.actionExecuted) {
      const auth = gateRegistry
        .getActionGate()
        .authorize({
          proposalId: uuidv4(),
          operation: `game:${this.focus.id}:${t.decision.actionExecuted}`,
          args: {},
        });
      if (!auth.authorized) {
        const learningEvent = this.negotiator.createLearningEvent(
          this.focus,
          { ...t.decision, actionExecuted: null, vetoedBy: auth.vetoReason ?? 'kernel-gate' },
          {
            reward: 0,
            terminal: false,
            perception: this.game.observe(),
            previousPerception: this.previousPerception,
          }
        );
        for (const reflex of t.deliveringReflexes) reflex.learn(learningEvent);
        t.suppressPanel = true;
        this.previousPerception = this.game.observe();
        return;
      }
      const previousPerception = this.game.observe();
      const action = this.parseAction(t.decision.actionExecuted);
      t.gameOutcome = this.game.step(action);
      const nextPerception = this.game.observe();
      this.syncScope();
      t.perceptionPair = { previousPerception, nextPerception };

      // REWARD: epistemic firewall — reward may only tune policy, never truth
      const firewall = gateRegistry.getRewardGate().process({
        eventId: uuidv4(),
        rewardSignal: Math.max(-1, Math.min(1, t.gameOutcome.reward)),
        rewardType: 'extrinsic',
        targetType: 'policy-weights',
        targetId: this.focus.id,
        domain: 'external-reflex',
      });
      if (!firewall.accepted) t.suppressPanel = true;
    } else if (t.decision.action) {
      this.trackVeto(t);
    }
  }

  /** LEARN: fan learning events to every proposing reflex; trace + panel close the tick. */
  private learnStage(t: TickState): void {
    if (t.suppressPanel || !t.proposed) return;
    if (t.decision.actionExecuted && t.gameOutcome && t.perceptionPair) {
      // REWARD: Convert outcome to beliefs
      const rewardBeliefs = this.focus.getRewardGate().toBeliefs(t.gameOutcome);
      for (const belief of rewardBeliefs) {
        this.focus.tasks.add(belief);
      }
      t.focusReport.gates.rewards += rewardBeliefs.length;

      // LEARNING: every reflex that proposed the executed action learns (A2 fan-out)
      const learningEvent = this.negotiator.createLearningEvent(this.focus, t.decision, {
        reward: t.gameOutcome.reward,
        terminal: t.gameOutcome.terminal,
        perception: t.perceptionPair.nextPerception,
        previousPerception: t.perceptionPair.previousPerception,
      });
      for (const reflex of t.deliveringReflexes) reflex.learn(learningEvent);
      this.episodeHistory.push({ action: t.decision.action!, reward: t.gameOutcome.reward });

      this.logGameTrace({
        cycle: this.cycle,
        legalActions: t.legalActions as number[],
        reflexProposal: t.bestReflexProposal,
        nalDerivations: t.nalDerivations,
        negotiatedAction: t.decision,
        reward: t.gameOutcome.reward,
        terminal: t.gameOutcome.terminal,
        focusWeightDelta: this.focus.weight - t.prevWeight,
      });
    } else if (t.decision.action) {
      const learningEvent = this.negotiator.createLearningEvent(this.focus, t.decision, {
        reward: 0,
        terminal: false,
        perception: this.game.observe(),
        previousPerception: this.previousPerception,
      });
      for (const reflex of t.deliveringReflexes) reflex.learn(learningEvent);

      this.logGameTrace({
        cycle: this.cycle,
        legalActions: t.legalActions as number[],
        reflexProposal: t.bestReflexProposal,
        nalDerivations: t.nalDerivations,
        negotiatedAction: t.decision,
        reward: 0,
        terminal: false,
        focusWeightDelta: this.focus.weight - t.prevWeight,
      });
    }
  }

  /** G2: promote the episode's worst/best action patterns into advisory beliefs. */
  private consolidateEpisode(): void {
    if (!this.schemaInduction) {
      this.episodeHistory = [];
      return;
    }
    const schemas = induceEpisodeSchemas(this.episodeHistory);
    for (const schema of schemas) {
      if (this.promotedSchemas.some((p) => p.action === schema.action && p.kind === schema.kind))
        continue;
      this.promotedSchemas.push(schema);
      this.seedBelief(
        actionRuleBelief(
          schema.action,
          schema.kind === 'bad' ? 'bad_outcome' : 'good_outcome',
          schema.kind === 'bad' ? { f: 0.1, c: 0.9 } : { f: 0.9, c: 0.9 }
        )
      );
    }
    this.episodeHistory = [];
  }

  /** G2: schemas promoted so far (advisory beliefs the Negotiator weighs next episode). */
  getPromotedSchemas(): readonly PromotedSchema[] {
    return this.promotedSchemas;
  }

  /** Veto bookkeeping (2C) — counters, details, and the E7 justification record. */
  private trackVeto(t: TickState): void {
    this.vetoCount++;
    this.currentEpisodeVetos++;
    const vetoDerivation =
      t.nalDerivations.find(
        (d) => d.action === t.decision.action && d.truth.f < 0.3 && d.truth.c >= 0.8
      ) ?? t.nalDerivations[0];
    this.vetoDetails.push({
      cycle: this.cycle,
      action: t.decision.action!,
      vetoReason: t.decision.vetoedBy ?? 'unknown',
      derivation: vetoDerivation
        ? { action: vetoDerivation.action, truth: vetoDerivation.truth, source: vetoDerivation.source }
        : { action: '', truth: { f: 0, c: 0 }, source: 'none' },
    });
    if (vetoDerivation)
      this.vetoJustifications.push(
        this.buildVetoJustification(this.cycle, t.decision.action!, vetoDerivation)
      );
  }

  private panelEntry(
    t: TickState,
    handover: boolean,
    reward: number,
    terminal: boolean
  ): TickPanelEntry {
    return {
      cycle: this.cycle,
      proposalActions: t.proposalActions,
      nalDerivations: t.nalDerivations,
      decision: t.decision,
      handover,
      reward,
      terminal,
      focusWeight: this.focus.weight,
    };
  }

  /** PANEL/consolidate: thought-stream entry + perception advance for completed ticks. */
  private endTick(t: TickState): { focusReport: any; gameOutcome: GameOutcome | null } {
    if (t.proposed && !t.suppressPanel) {
      this.recordPanel(
        this.panelEntry(
          t,
          this.lastTickHandover,
          t.gameOutcome?.reward ?? 0,
          t.gameOutcome?.terminal ?? false
        )
      );
      this.previousPerception = this.game.observe();
    }
    return { focusReport: { ...t.focusReport, cycle: this.cycle }, gameOutcome: t.gameOutcome };
  }

  getFocus(): Focus {
    return this.focus;
  }

  getGame(): Game {
    return this.game;
  }

  getCycle(): number {
    return this.cycle;
  }

  /** E2 handover telemetry. */
  getHandoverCount(): number {
    return this.handoverCount;
  }

  didLastTickHandover(): boolean {
    return this.lastTickHandover;
  }

  /** Call at the end of each episode to track veto rate (2C). */
  markEpisodeEnd(): void {
    this.episodeVetoCounts.push(this.currentEpisodeVetos);
    this.currentEpisodeVetos = 0;
    this.consolidateEpisode();
    // Decay epsilon on reflexes
    for (const reflex of this.focus.reflexes) {
      if (typeof (reflex as any).onEpisodeEnd === 'function') {
        (reflex as any).onEpisodeEnd();
      }
    }
  }

  /** Get veto statistics (2C). */
  getVetoStats(): {
    totalVetos: number;
    episodeVetoCounts: number[];
    vetoRate: number;
    vetoDetails: Array<{
      cycle: number;
      action: string;
      vetoReason: string;
      derivation: { action: string; truth: { f: number; c: number }; source: string };
    }>;
  } {
    const totalEpisodes = this.episodeVetoCounts.length + (this.currentEpisodeVetos > 0 ? 1 : 0);
    const totalVetosInEpisodes = this.episodeVetoCounts.reduce((a, b) => a + b, 0) + this.currentEpisodeVetos;
    return {
      totalVetos: this.vetoCount,
      episodeVetoCounts: [...this.episodeVetoCounts, this.currentEpisodeVetos].filter((v) => v > 0),
      vetoRate: totalEpisodes > 0 ? totalVetosInEpisodes / totalEpisodes : 0,
      vetoDetails: [...this.vetoDetails],
    };
  }

  /** Reset veto tracking for a new run. */
  resetVetoTracking(): void {
    this.vetoCount = 0;
    this.vetoDetails = [];
    this.episodeVetoCounts = [];
    this.currentEpisodeVetos = 0;
    this.vetoJustifications = [];
  }

  private parseAction(actionStr: string): any {
    // Try to parse as number for GridWorld
    const num = parseInt(actionStr, 10);
    if (!isNaN(num)) return num;
    // Return as-is for string actions
    return actionStr;
  }
}

export function createGameFocus(options: GameFocusOptions): GameFocus {
  return new GameFocus(options);
}
