import { v4 as uuidv4 } from 'uuid';
import { mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { PriorityBag } from '../bag/Bag.js';
import type { Game, GameOutcome, Perception } from '../game/Game.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { EmbeddingCache, JudgmentManifold } from '../lm/system-one/types.js';
import { gateRegistry } from '../kernel/index.js';
import { type NALDerivation, NegotiationDecision, Negotiator } from '../reflex/Negotiator.js';
import { ActionProposal, LearningEvent, type Reflex } from '../reflex/Reflex.js';
import { Focus, type FocusOptions } from './Focus.js';

export interface GameFocusOptions {
  focusId: string;
  game: Game;
  focusOptions?: Partial<FocusOptions>;
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

    this.focus = new Focus({
      id: options.focusId,
      taskCapacity: options.focusOptions?.taskCapacity ?? 1000,
      conceptCapacity: options.focusOptions?.conceptCapacity ?? 500,
      weight: options.focusOptions?.weight ?? 1.0,
    });

    this.negotiator = new Negotiator({ nalVetoThreshold: 0.8, reflexThreshold: -1 });

    this.focus.bindGame(this.game);

    // Sandboxed game worlds: escalate autonomy to sandbox-execute and allow the
    // game's own legal actions through the kernel ActionGate.
    const actionGate = gateRegistry.getActionGate();
    actionGate.setAutonomyMode('sandbox-execute');
    for (const a of this.game.legalActions(this.game.state()))
      actionGate.addAllowedOperation(String(a));

    this.initGameTrace();
  }

  bindReflex(reflex: Reflex): void {
    this.focus.bindReflex(reflex);
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
          embeddingCache.write(JSON.stringify(observation.features ?? observation.stateId)),
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

    // Game loops budget per step (the `step(budget)` contract), not per focus
    // lifetime — renew the scope so long-running training isn't starved.
    gateRegistry.getBudgetGate().createScope(this.focus.id);
    const budgetCheck = gateRegistry
      .getBudgetGate()
      .check({ operation: 'nal-step', estimatedCost: 1, scopeId: this.focus.id });
    if (!budgetCheck.granted)
      return { focusReport: { terminated: budgetCheck.terminationReason }, gameOutcome: null };

    // PERCEPTION: Focus step handles perception
    const focusReport = await this.focus.step(budget);

    // ATTEND: prefetch semantic reflex judgments before the synchronous propose contract (C1)
    await this.prefetchForReflexes();

    let gameOutcome: GameOutcome | null = null;

    // PROPOSAL: Reflexes propose actions
    for (const reflex of this.focus.reflexes) {
      const proposals = reflex.propose(
        this.game.observe(),
        this.game.legalActions(this.game.state())
      );
      if (proposals.length > 0) {
        // Convert proposals to goals and add to focus tasks
        const goals = this.focus.getActionGate().toGoals(proposals);
        for (const goal of goals) {
          this.focus.tasks.add(goal);
        }
        focusReport.gates.actions += goals.length;

        // NEGOTIATION: Get NAL derivations and resolve
        const nalDerivations: NALDerivation[] = [];
        for (const proposal of proposals) {
          const derivations = this.focus.getNALDerivations(proposal.action);
          nalDerivations.push(...derivations);
        }

        const bestReflexProposal = proposals.reduce((best, p) =>
          p.value * p.confidence > best.value * best.confidence ? p : best
        );

        const decision = this.negotiator.resolve(proposals, nalDerivations);

        // Get legal actions for logging
        const legalActions = this.game.legalActions(this.game.state());
        const prevWeight = this.focus.weight;

        // EXECUTION: Kernel ActionGate authorizes before world mutation
        if (decision.actionExecuted) {
          const auth = gateRegistry
            .getActionGate()
            .authorize({ proposalId: uuidv4(), operation: decision.actionExecuted, args: {} });
          if (!auth.authorized) {
            const learningEvent = this.negotiator.createLearningEvent(
              this.focus,
              { ...decision, actionExecuted: null, vetoedBy: auth.vetoReason ?? 'kernel-gate' },
              {
                reward: 0,
                terminal: false,
                perception: this.game.observe(),
                previousPerception: this.previousPerception,
              }
            );
            reflex.learn(learningEvent);
            this.previousPerception = this.game.observe();
            break;
          }
          const previousPerception = this.game.observe();
          const action = this.parseAction(decision.actionExecuted);
          gameOutcome = this.game.step(action);
          const nextPerception = this.game.observe();

          // REWARD: epistemic firewall — reward may only tune policy, never truth
          const firewall = gateRegistry.getRewardGate().process({
            eventId: uuidv4(),
            rewardSignal: Math.max(-1, Math.min(1, gameOutcome.reward)),
            rewardType: 'extrinsic',
            targetType: 'policy-weights',
            targetId: this.focus.id,
            domain: 'external-reflex',
          });
          if (!firewall.accepted) break;
          // REWARD: Convert outcome to beliefs
          const rewardBeliefs = this.focus.getRewardGate().toBeliefs(gameOutcome);
          for (const belief of rewardBeliefs) {
            this.focus.tasks.add(belief);
          }
          focusReport.gates.rewards += rewardBeliefs.length;

          // LEARNING: Reflex learns from outcome
          const learningEvent = this.negotiator.createLearningEvent(this.focus, decision, {
            reward: gameOutcome.reward,
            terminal: gameOutcome.terminal,
            perception: nextPerception,
            previousPerception,
          });
          reflex.learn(learningEvent);

          // Game trace logging (2A)
          this.logGameTrace({
            cycle: this.cycle,
            legalActions: legalActions as number[],
            reflexProposal: bestReflexProposal,
            nalDerivations,
            negotiatedAction: decision,
            reward: gameOutcome.reward,
            terminal: gameOutcome.terminal,
            focusWeightDelta: this.focus.weight - prevWeight,
          });
        } else if (decision.action) {
          // Action was vetoed - reflex learns it was overridden
          this.vetoCount++;
          this.currentEpisodeVetos++;
          const vetoDerivation = nalDerivations.find(
            (d) => d.action === decision.action && d.truth.f < 0.3 && d.truth.c >= 0.8
          ) ?? nalDerivations[0];
          this.vetoDetails.push({
            cycle: this.cycle,
            action: decision.action,
            vetoReason: decision.vetoedBy ?? 'unknown',
            derivation: vetoDerivation
              ? { action: vetoDerivation.action, truth: vetoDerivation.truth, source: vetoDerivation.source }
              : { action: '', truth: { f: 0, c: 0 }, source: 'none' },
          });

          const learningEvent = this.negotiator.createLearningEvent(this.focus, decision, {
            reward: 0,
            terminal: false,
            perception: this.game.observe(),
            previousPerception: this.previousPerception,
          });
          reflex.learn(learningEvent);

          // Game trace logging for vetoed action (2A)
          this.logGameTrace({
            cycle: this.cycle,
            legalActions: legalActions as number[],
            reflexProposal: bestReflexProposal,
            nalDerivations,
            negotiatedAction: decision,
            reward: 0,
            terminal: false,
            focusWeightDelta: this.focus.weight - prevWeight,
          });
        }

        this.previousPerception = this.game.observe();
        break;
      }
    }

    return { focusReport: { ...focusReport, cycle: this.cycle }, gameOutcome };
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

  /** Call at the end of each episode to track veto rate (2C). */
  markEpisodeEnd(): void {
    this.episodeVetoCounts.push(this.currentEpisodeVetos);
    this.currentEpisodeVetos = 0;
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
