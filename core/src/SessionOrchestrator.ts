export interface Session {
  readonly key: string;
  readonly history: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
  readonly pinnedBeliefs: string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export class SessionOrchestrator {
  private sessionInstructions = new WeakMap<Session, string>();
  private sessionScratchpad = new WeakMap<Session, Map<string, string>>();

  getScratchpad(session?: Session): Map<string, string> | undefined {
    if (!session) return undefined;
    let pad = this.sessionScratchpad.get(session);
    if (!pad) {
      pad = new Map();
      this.sessionScratchpad.set(session, pad);
    }
    return pad;
  }

  getSessionInstructions(session: Session): string | undefined {
    return this.sessionInstructions.get(session);
  }

  setSessionInstructions(session: Session, mode: 'append' | 'replace', instructions: string): void {
    const existing = this.sessionInstructions.get(session) ?? '';
    this.sessionInstructions.set(
      session,
      mode === 'replace' ? instructions : existing ? `${existing}\n${instructions}` : instructions
    );
  }
}
