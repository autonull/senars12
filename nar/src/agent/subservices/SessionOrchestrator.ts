import type { ConversationSession } from '../ConversationSession.js';

export class SessionOrchestrator {
  private sessionInstructions = new WeakMap<ConversationSession, string>();
  private sessionScratchpad = new WeakMap<ConversationSession, Map<string, string>>();

  getScratchpad(session?: ConversationSession): Map<string, string> | undefined {
    if (!session) return undefined;
    let pad = this.sessionScratchpad.get(session);
    if (!pad) {
      pad = new Map();
      this.sessionScratchpad.set(session, pad);
    }
    return pad;
  }

  getSessionInstructions(session: ConversationSession): string | undefined {
    return this.sessionInstructions.get(session);
  }

  setSessionInstructions(
    session: ConversationSession,
    mode: 'append' | 'replace',
    instructions: string
  ): void {
    const existing = this.sessionInstructions.get(session) ?? '';
    this.sessionInstructions.set(
      session,
      mode === 'replace' ? instructions : existing ? `${existing}\n${instructions}` : instructions
    );
  }
}
