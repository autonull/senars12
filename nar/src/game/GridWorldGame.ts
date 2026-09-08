import {Game, Perception, GameOutcome} from '../game/Game.js';
import {GridWorldEnv, GridWorldState, GridAction, GridWorldConfig} from './GridWorldEnv.js';

export class GridWorldGame implements Game<GridWorldState, GridAction> {
  readonly id: string;
  private readonly env: GridWorldEnv;
  private currentState: GridWorldState;

  constructor(config: GridWorldConfig & { id?: string }) {
    this.id = config.id ?? 'gridworld';
    this.env = new GridWorldEnv(config);
    this.currentState = this.env.getState();
  }

  observe(): Perception {
    const state = this.env.getState();
    const features: Record<string, number> = {
      row: state.row,
      col: state.col,
      distanceToGoal: this.getDistanceToGoal(state),
    };

    return {
      stateId: this.env.getStateKey(),
      features,
      confidence: 1.0,
      terminal: this.isTerminal(),
    };
  }

  state(): GridWorldState {
    return this.currentState;
  }

  legalActions(state: GridWorldState): GridAction[] {
    const actions: GridAction[] = [0, 1, 2, 3];
    const {row, col} = state;
    const {rows, cols, walls} = this.getEnvInfo();

    const legal: GridAction[] = [];
    for (const action of actions) {
      let newRow = row, newCol = col;
      switch (action) {
        case 0: newRow = Math.max(0, row - 1); break;
        case 1: newCol = Math.min(cols - 1, col + 1); break;
        case 2: newRow = Math.min(rows - 1, row + 1); break;
        case 3: newCol = Math.max(0, col - 1); break;
      }
      if (!walls.has(`${newRow},${newCol}`)) {
        legal.push(action);
      }
    }
    return legal.length > 0 ? legal : actions;
  }

  step(action: GridAction): GameOutcome {
    const result = this.env.step(action);
    this.currentState = result.state;
    return {
      reward: result.reward,
      terminal: result.done,
      info: { stepCount: this.env['stepCount'] },
    };
  }

  reset(): void {
    this.currentState = this.env.reset();
  }

  getEnv(): GridWorldEnv {
    return this.env;
  }

  private getDistanceToGoal(state: GridWorldState): number {
    const goal = (this.env as any).goalPos;
    return Math.abs(state.row - goal.row) + Math.abs(state.col - goal.col);
  }

  private isTerminal(): boolean {
    const state = this.env.getState();
    const goal = (this.env as any).goalPos;
    return state.row === goal.row && state.col === goal.col;
  }

  private getEnvInfo(): { rows: number; cols: number; walls: Set<string> } {
    return {
      rows: (this.env as any).rows,
      cols: (this.env as any).cols,
      walls: (this.env as any).walls,
    };
  }
}

export function createGridWorldGame(config: GridWorldConfig & { id?: string }): GridWorldGame {
  return new GridWorldGame(config);
}