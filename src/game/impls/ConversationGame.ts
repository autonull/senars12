import type { Game, Perception, GameOutcome } from '../Game';
import { GameBase, type GameConfig } from '../GameBase';

export interface ConversationState {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  pendingResponse?: string;
  userIntent?: string;
  openTasks: string[];
}

export interface ConversationAction {
  type: 'acknowledge' | 'clarify' | 'answer' | 'defer' | 'tool_use';
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export class ConversationGame extends GameBase<ConversationState, ConversationAction> {
  private _state: ConversationState = {
    history: [],
    openTasks: [],
  };

  constructor(config: GameConfig = {}) {
    super(config.id ?? 'conversation', config);
  }

  protected override getInitialState(): ConversationState {
    return { history: [], openTasks: [] };
  }

  protected override getStateId(state: ConversationState): string {
    return `conv-${state.history.length}`;
  }

  override step(action: ConversationAction): GameOutcome {
    this.incrementStep();
    switch (action.type) {
      case 'acknowledge':
        this._state.history.push({ role: 'assistant', content: action.content ?? 'Understood.' });
        return { reward: 0.5, terminal: false, info: { actionType: 'acknowledge' } };
      case 'clarify':
        this._state.history.push({
          role: 'assistant',
          content: action.content ?? 'Could you clarify?',
        });
        return { reward: 0.3, terminal: false, info: { actionType: 'clarify' } };
      case 'answer':
        this._state.history.push({ role: 'assistant', content: action.content ?? 'Answer.' });
        return { reward: 1.0, terminal: false, info: { actionType: 'answer' } };
      case 'defer':
        this._state.history.push({
          role: 'assistant',
          content: action.content ?? 'I need to think about this.',
        });
        return { reward: 0.1, terminal: false, info: { actionType: 'defer' } };
      case 'tool_use':
        this._state.history.push({ role: 'assistant', content: `Using tool: ${action.toolName}` });
        return {
          reward: 0.7,
          terminal: false,
          info: { actionType: 'tool_use', tool: action.toolName },
        };
      default:
        return { reward: 0, terminal: false, info: { actionType: 'unknown' } };
    }
  }

  override isTerminal(_state: ConversationState): boolean {
    return false; // Conversation games don't naturally terminate
  }

  override legalActions(_state: ConversationState): ConversationAction[] {
    return [
      { type: 'acknowledge' },
      { type: 'clarify' },
      { type: 'answer' },
      { type: 'defer' },
    ];
  }

  override state(): ConversationState {
    return {
      history: [...this._state.history],
      pendingResponse: this._state.pendingResponse,
      userIntent: this._state.userIntent,
      openTasks: [...this._state.openTasks],
    };
  }

  override observe(): Perception {
    const lastUserMsg = this._state.history
      .slice()
      .reverse()
      .find((m: { role: string }) => m.role === 'user');
    const lastAssistantMsg = this._state.history
      .slice()
      .reverse()
      .find((m: { role: string }) => m.role === 'assistant');

    const features: Record<string, number> = {
      historyLength: this._state.history.length,
      hasPendingResponse: this._state.pendingResponse ? 1 : 0,
      openTasksCount: this._state.openTasks.length,
      lastUserLength: lastUserMsg?.content.length ?? 0,
      lastAssistantLength: lastAssistantMsg?.content.length ?? 0,
    };

    return {
      stateId: this.getStateId(this.state()),
      features,
      confidence: 1.0,
      terminal: false,
    };
  }

  override reset(): ConversationState {
    this._state = { history: [], openTasks: [] };
    this.stepCount = 0;
    return this.getInitialState();
  }

  addUserMessage(content: string): void {
    this._state.history.push({ role: 'user', content });
  }

  setPendingResponse(response: string): void {
    this._state.pendingResponse = response;
  }

  clearPendingResponse(): void {
    this._state.pendingResponse = undefined;
  }

  addOpenTask(task: string): void {
    this._state.openTasks.push(task);
  }

  completeOpenTask(task: string): void {
    this._state.openTasks = this._state.openTasks.filter((t) => t !== task);
  }
}

export function createConversationGame(config: GameConfig = {}): ConversationGame {
  return new ConversationGame(config);
}