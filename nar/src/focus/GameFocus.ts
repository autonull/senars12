import {Focus, FocusOptions} from './Focus.js';
import type {Game, Perception, GameOutcome} from '../game/Game.js';
import {Reflex, ActionProposal, LearningEvent} from '../reflex/Reflex.js';
import {Negotiator, NALDerivation, NegotiationDecision} from '../reflex/Negotiator.js';
import {PriorityBag} from '../bag/Bag.js';
import {gateRegistry} from '../kernel/index.js';
import {v4 as uuidv4} from 'uuid';

export interface GameFocusOptions {
  focusId: string;
  game: Game;
  focusOptions?: Partial<FocusOptions>;
}

export class GameFocus {
  readonly focus: Focus;
  readonly game: Game;
  private readonly negotiator: Negotiator;
  private cycle = 0;
  private previousPerception: Perception | null = null;

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
  }

  bindReflex(reflex: Reflex): void {
    this.focus.bindReflex(reflex);
  }

  async step(budget: number): Promise<{
    focusReport: any;
    gameOutcome: GameOutcome | null;
  }> {
    this.cycle++;

    const budgetCheck = gateRegistry.getBudgetGate().check({ operation: 'nal-step', estimatedCost: 1 });
    if (!budgetCheck.granted) return { focusReport: { terminated: budgetCheck.terminationReason }, gameOutcome: null };

    // PERCEPTION: Focus step handles perception
    const focusReport = await this.focus.step(budget);

    let gameOutcome: GameOutcome | null = null;

    // PROPOSAL: Reflexes propose actions
    for (const reflex of this.focus.reflexes) {
      const proposals = reflex.propose(this.game.state(), this.game.legalActions(this.game.state()));
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

        const decision = this.negotiator.resolve(proposals, nalDerivations);

        // EXECUTION: Kernel ActionGate authorizes before world mutation
        if (decision.actionExecuted) {
          const auth = gateRegistry.getActionGate().authorize({ proposalId: uuidv4(), operation: decision.actionExecuted, args: {} });
          if (!auth.authorized) {
            const learningEvent = this.negotiator.createLearningEvent(this.focus, { ...decision, actionExecuted: null, vetoedBy: auth.vetoReason ?? 'kernel-gate' }, { reward: 0, terminal: false, perception: this.game.observe(), previousPerception: this.previousPerception });
            reflex.learn(learningEvent);
            this.previousPerception = this.game.observe();
            break;
          }
          const previousPerception = this.game.observe();
          const action = this.parseAction(decision.actionExecuted);
          gameOutcome = this.game.step(action);
          const nextPerception = this.game.observe();

          // REWARD: epistemic firewall — reward may only tune policy, never truth
          const firewall = gateRegistry.getRewardGate().process({ eventId: uuidv4(), rewardSignal: Math.max(-1, Math.min(1, gameOutcome.reward)), rewardType: 'extrinsic', targetType: 'policy-weights', targetId: this.focus.id });
          if (!firewall.accepted) break;
          // REWARD: Convert outcome to beliefs
          const rewardBeliefs = this.focus.getRewardGate().toBeliefs(gameOutcome);
          for (const belief of rewardBeliefs) {
            this.focus.tasks.add(belief);
          }
          focusReport.gates.rewards += rewardBeliefs.length;

          // LEARNING: Reflex learns from outcome
          const learningEvent = this.negotiator.createLearningEvent(
            this.focus,
            decision,
            { reward: gameOutcome.reward, terminal: gameOutcome.terminal, perception: nextPerception, previousPerception }
          );
          reflex.learn(learningEvent);
        } else if (decision.action) {
          // Action was vetoed - reflex learns it was overridden
          const learningEvent = this.negotiator.createLearningEvent(
            this.focus,
            decision,
            { reward: 0, terminal: false, perception: this.game.observe(), previousPerception: this.previousPerception }
          );
          reflex.learn(learningEvent);
        }
        
        this.previousPerception = this.game.observe();
        break;
      }
    }

    return { focusReport, gameOutcome };
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