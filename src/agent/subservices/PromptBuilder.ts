import type {NAR} from '../../nar/nar.js';
import type {ConversationSession} from '../ConversationSession.js';
import type {DerivationEntry} from '../agent.js';
import type {SessionOrchestrator} from './SessionOrchestrator.js';
import type {ContextAssemblerOpts} from '../../nar/nl/context-assembler.js';

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
        const instruction = session ? this.sessionOrchestrator.getSessionInstructions(session) : this.systemInstructions;
        const parts: string[] = [];

        const constitution = this.nar?.getConstitution?.() ?? [];
        if (constitution.length > 0) {
            parts.push('## Constitution');
            for (const b of constitution) {
                parts.push((b as {term: {toString(): string}}).term.toString());
            }
        }

        if (instruction) {
            parts.push('## Instructions');
            parts.push(instruction);
        }

        if (session) {
            const pad = this.sessionOrchestrator.getScratchpad(session);
            if (pad && pad.size > 0) {
                parts.push('## Session Context');
                for (const [k, v] of pad) {
                    parts.push(`${k}: ${v}`);
                }
            }
        }

        if (this.recentDerivations.length > 0) {
            parts.push('## Recent Derivations');
            for (const d of this.recentDerivations.slice(-10)) {
                const truth = d.truth ? ` (f=${d.truth.f.toFixed(2)} c=${d.truth.c.toFixed(2)})` : '';
                parts.push(`${d.term}${truth}`);
            }
        }

        if (this.nar && this.contextAssembler) {
            const nlContext = this.contextAssembler.assemble(this.nar, input, this.contextOpts);
            const stateParts: string[] = [];
            if (nlContext.beliefs && nlContext.beliefs.length > 0) {
                stateParts.push('Related beliefs:');
                for (const b of nlContext.beliefs) {
                    stateParts.push(`  ${b}`);
                }
            }
            if (nlContext.activeGoals && nlContext.activeGoals.length > 0) {
                stateParts.push('Active goals:');
                for (const g of nlContext.activeGoals) {
                    stateParts.push(`  ${g}`);
                }
            }
            if (nlContext.recentDerivations && nlContext.recentDerivations.length > 0) {
                stateParts.push('Recent derivations:');
                for (const d of nlContext.recentDerivations) {
                    stateParts.push(`  ${d}`);
                }
            }
            if (nlContext.memoryHealth) {
                stateParts.push(`Memory: ${nlContext.memoryHealth.totalConcepts} concepts, pressure ${(nlContext.memoryHealth.pressure * 100).toFixed(0)}%`);
            }
            const driveManager = this.nar.getDriveManager?.();
            if (driveManager) {
                const activeDrives = driveManager.getAllStates().filter(d => d.isActive);
                if (activeDrives.length > 0) {
                    stateParts.push('Active Drives:');
                    for (const d of activeDrives) {
                        stateParts.push(`  ${d.spec.id}: intensity ${(d.currentIntensity * 100).toFixed(0)}%`);
                    }
                }
            }

            if (stateParts.length > 0) {
                parts.push('## Cognitive State');
                parts.push(stateParts.join('\n'));
            }
        }

        parts.push('## Tool Use Strategy');
        parts.push('Think step by step. Use tools when needed. Be concise.');

        return parts.join('\n\n');
    }
}
