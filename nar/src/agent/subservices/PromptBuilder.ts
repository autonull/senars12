import type { NAR } from '../..';
import type { ContextAssemblerOpts } from '../../nl';
import type { ConversationSession } from '../ConversationSession.js';
import type { DerivationEntry } from '../agent.js';
import type { SessionOrchestrator } from './SessionOrchestrator.js';

export class PromptBuilder {
  constructor(
    private systemInstructions: string,
    private sessionOrchestrator: SessionOrchestrator,
    private recentDerivations: DerivationEntry[],
    private nar: NAR | undefined,
    private contextAssembler: any | undefined,
    private contextOpts: ContextAssemblerOpts
  ) {}

  async buildSystemPrompt(input: string, session?: ConversationSession): Promise<string> {
    const instruction = session
      ? this.sessionOrchestrator.getSessionInstructions(session)
      : this.systemInstructions;
    const parts: string[] = [];

    const constitution = this.nar?.getConstitution?.() ?? [];
    if (constitution.length > 0) {
      parts.push('## Constitution');
      for (const b of constitution)
        parts.push((b as { term: { toString(): string } }).term.toString());
    }

    if (instruction) {
      parts.push('## Instructions', instruction);
    }

    if (session) {
      const pad = this.sessionOrchestrator.getScratchpad(session);
      if (pad && pad.size > 0) {
        parts.push('## Session Context');
        for (const [k, v] of pad) parts.push(`${k}: ${v}`);
      }
    }

    if (this.recentDerivations.length > 0) {
      parts.push('## Recent Derivations');
      for (const d of this.recentDerivations.slice(-10)) {
        const truth = d.truth ? ` (f=${d.truth.f.toFixed(2)} c=${d.truth.c.toFixed(2)})` : '';
        parts.push(`${d.term}${truth}`);
      }
    }

    const cognitive = this.buildCognitiveState(input);
    if (cognitive) parts.push('## Cognitive State', cognitive);

    parts.push('## Tool Use Strategy', 'Think step by step. Use tools when needed. Be concise.');

    return parts.join('\n\n');
  }

  private buildCognitiveState(input: string): string | null {
    if (!this.nar || !this.contextAssembler) return null;
    const nlContext = this.contextAssembler.assemble(this.nar, input, this.contextOpts);
    const lines: string[] = [];

    const addSection = (label: string, items: string[]) => {
      if (items.length === 0) return;
      lines.push(`${label}:`);
      for (const item of items) lines.push(`  ${item}`);
    };

    addSection('Related beliefs', nlContext.beliefs ?? []);
    addSection('Active goals', nlContext.activeGoals ?? []);
    addSection('Recent derivations', nlContext.recentDerivations ?? []);

    if (nlContext.memoryHealth) {
      lines.push(
        `Memory: ${nlContext.memoryHealth.totalConcepts} concepts, pressure ${(nlContext.memoryHealth.pressure * 100).toFixed(0)}%`
      );
    }

    const driveManager = this.nar.getDriveManager?.();
    if (driveManager) {
      const activeDrives = driveManager.getAllStates().filter((d) => d.isActive);
      if (activeDrives.length > 0) {
        lines.push('Active Drives:');
        for (const d of activeDrives)
          lines.push(`  ${d.spec.id}: intensity ${(d.currentIntensity * 100).toFixed(0)}%`);
      }
    }

    return lines.length > 0 ? lines.join('\n') : null;
  }
}
