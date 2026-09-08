import {Focus, FocusOptions} from './Focus.js';
import {Game, Perception, GameOutcome} from './Focus.js';
import {PriorityBag} from '../bag/Bag.js';

export interface GameFocusOptions {
  focusId: string;
  game: Game;
  focusOptions?: Partial<FocusOptions>;
}

export class GameFocus {
  readonly focus: Focus;
  readonly game: Game;
  private cycle = 0;

  constructor(options: GameFocusOptions) {
    this.game = options.game;

    this.focus = new Focus({
      id: options.focusId,
      taskCapacity: options.focusOptions?.taskCapacity ?? 1000,
      conceptCapacity: options.focusOptions?.conceptCapacity ?? 500,
      weight: options.focusOptions?.weight ?? 1.0,
    });

    this.focus.bindGame(this.game);
  }

  bindReflex(reflex: any): void {
    this.focus.bindReflex(reflex);
  }

  async step(budget: number): Promise<{
    focusReport: any;
    gameOutcome: GameOutcome | null;
  }> {
    this.cycle++;

    const focusReport = await this.focus.step(budget);

    let gameOutcome: GameOutcome | null = null;

    for (const reflex of (this.focus as any).reflexes) {
      const proposals = reflex.propose(this.game.state(), this.game.legalActions(this.game.state()));
      if (proposals.length > 0) {
        const bestProposal = proposals[0];
        gameOutcome = this.game.step(bestProposal.action as any);

        const rewardBeliefs = (this.focus as any).getRewardGate().toBeliefs(gameOutcome);
        for (const belief of rewardBeliefs) {
          (this.focus as any).tasks.add(belief);
        }

        reflex.learn({
          perception: this.game.observe(),
          actionProposed: bestProposal.action,
          actionExecuted: bestProposal.action,
          reward: gameOutcome.reward,
          terminal: gameOutcome.terminal,
          overriddenBy: null,
        });
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
}

export function createGameFocus(options: GameFocusOptions): GameFocus {
  return new GameFocus(options);
}