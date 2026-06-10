import type {EpisodeWorkingMemory} from './EpisodeWorkingMemory.js';
import type {NAR} from '../nar/nar.js';
import type {ContextOpts} from '../nar/nl/context.js';
import {ContextBuilder} from '../nar/nl/context.js';

const REACT_STRATEGY = `## Tool Use Strategy

When responding to the user, follow this reasoning strategy:
1. **Decompose**: if the question needs Narsese reasoning, use \`nar_believe\` + \`nar_query\` (and \`nar_reason\` for multi-step inference).
2. **Persist explicit facts**: use the \`know\` tool to store user-stated facts so they survive across sessions.
3. **Compute carefully**: use \`calculate\` for any arithmetic before answering.
4. **Check existing knowledge**: if uncertain, query NAR with \`nar_query\` or recall episodic memory with \`recall\` before guessing.
5. **Track working state**: use \`set_focus\` / \`set_goal\` / \`set_hypothesis\` to maintain explicit episode context; consult with \`snapshot_working_memory\` when in doubt.
6. **Be concise**: prefer the shortest correct answer. If you must call tools, batch them when independent.`;

export interface SystemPromptSections {
    constitution: string[];
    instructions: string | undefined;
    workingMemory: EpisodeWorkingMemory | undefined;
    cognitiveState: string;
    recentDerivations: ReadonlyArray<{timestamp: number; term: string}>;
    selfCorrectionNote: string | undefined;
    includeReActStrategy: boolean;
    previousSnapshotFingerprint: string | undefined;
}

export const renderSystemPrompt = (sections: SystemPromptSections): string => {
    const blocks: string[] = [];

    if (sections.constitution.length) {
        blocks.push('## Constitution\n' + sections.constitution.join('\n'));
    }

    if (sections.instructions?.trim()) {
        blocks.push('## Instructions\n' + sections.instructions.trim());
    }

    if (sections.workingMemory && sections.workingMemory.keys().length) {
        const wmSnapshot = sections.workingMemory.snapshot();
        const lines = Object.entries(wmSnapshot).map(([k, v]) => {
            const display = Array.isArray(v) ? v.join(' | ') : String(v);
            return `  - ${k}: ${display.length > 120 ? display.slice(0, 119) + '…' : display}`;
        });
        blocks.push('## Working Memory\n' + lines.join('\n'));
    }

    if (sections.cognitiveState.trim()) {
        blocks.push('## Cognitive State\n' + sections.cognitiveState.trim());
    }

    if (sections.recentDerivations.length) {
        const lines = sections.recentDerivations.slice(-10)
            .map(d => `  - [${new Date(d.timestamp).toISOString()}] ${d.term}`);
        blocks.push('## Recent Derivations\n' + lines.join('\n'));
    }

    if (sections.selfCorrectionNote) {
        blocks.push('## Self-Correction Notes\n' + sections.selfCorrectionNote);
    }

    if (sections.includeReActStrategy) {
        blocks.push(REACT_STRATEGY);
    }

    return blocks.join('\n\n') || 'You are SeNARS — a neurosymbolic cognitive kernel.';
};

export interface CognitiveStateOptions {
    attention: boolean;
    beliefs: boolean;
    goals: boolean;
}

export const buildCognitiveState = async (
    nar: NAR | undefined,
    input: string,
    options: CognitiveStateOptions,
    fingerprint: string,
    previousFingerprint: string | undefined,
    episodicEpisodes: ReadonlyArray<{type: string; content: string}>,
): Promise<{state: string; fingerprint: string; isDelta: boolean}> => {
    if (!nar) return {state: '', fingerprint, isDelta: false};

    const ctxBuilder = new ContextBuilder();
    const baseContext = ctxBuilder.build(nar, input, undefined, options);
    const episodicBlock = episodicEpisodes.length
        ? `Recent interactions:\n${episodicEpisodes.map((e: {type: string; content: string}) => {
            const preview = e.content.length > 80 ? e.content.slice(0, 79) + '...' : e.content;
            return `  - [${e.type}] ${preview}`;
        }).join('\n')}`
        : '';

    const combined = [baseContext, episodicBlock].filter(s => s.trim()).join('\n\n');
    const isDelta = Boolean(previousFingerprint) && fingerprint !== previousFingerprint;
    return {state: combined, fingerprint, isDelta};
};

export const computeCognitiveFingerprint = (
    nar: NAR | undefined,
    recentDerivations: ReadonlyArray<{timestamp: number; term: string}>,
    selfCorrectionNote: string | undefined,
): string => {
    if (!nar) return 'no-nar';
    const stats = nar.getStatistics?.() ?? {totalConcepts: 0, totalTasks: 0};
    const beliefCount = (nar.getBeliefs?.() ?? []).length;
    const goalCount = (nar.getGoals?.() ?? []).length;
    const lastDeriv = recentDerivations.at(-1)?.timestamp ?? 0;
    return `${stats.totalConcepts}|${stats.totalTasks}|${beliefCount}|${goalCount}|${lastDeriv}|${selfCorrectionNote ?? ''}`;
};
