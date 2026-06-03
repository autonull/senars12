import type {LMClient} from '../../nar/lm/types.js';
import type {NAR} from '../../nar/nar.js';
import type {ReasoningArtifact} from '../types.js';
import type {WorkingMemory} from './WorkingMemory.js';
import type {ReasoningTrace} from './ReasoningTrace.js';

export type ReflectionAction = 'accept' | 'revise' | 'open_question';

export interface ReflectionVerdict {
    action: ReflectionAction;
    reasoning?: string;
    revisedStatement?: string;
    revisedTruth?: {frequency: number; confidence: number};
    openQuestion?: string;
}

export interface ReflectionDeps {
    lmClient?: LMClient;
    nar?: NAR;
    workingMemory: WorkingMemory;
    maxOutputTokens?: number;
    timeoutMs?: number;
}

const REFLECTION_SYSTEM_PROMPT = `You are the reflection stage of a neurosymbolic cognitive agent.
You have just produced a candidate response. Review the trace and decide ONE of:

- "accept" — the response is correct as-is.
- "revise" — the response needs a belief revision. Provide a Narsese
  statement and a truth value (frequency 0..1, confidence 0..1).
- "open_question" — there is a meaningful question the system should
  track. Provide the question.

Respond ONLY with a single JSON object with these fields:
  { "action": "accept" | "revise" | "open_question",
    "reasoning": "...",
    "revisedStatement": "...",        // only for revise
    "revisedTruth": {"frequency":0..1,"confidence":0..1},
    "openQuestion": "..." }            // only for open_question
`;

const FALLBACK: ReflectionVerdict = {action: 'accept'};

export async function reflect(
    candidateText: string,
    trace: ReasoningTrace,
    deps: ReflectionDeps,
    signal?: AbortSignal,
): Promise<ReflectionVerdict> {
    if (!deps.lmClient) return FALLBACK;

    const traceSummary = trace.toMarkdown().slice(-2000);
    const wmSnapshot = JSON.stringify(deps.workingMemory.snapshot());
    const userPrompt = `Candidate response:\n"""${candidateText}"""\n\nWorking memory:\n${wmSnapshot}\n\nTrace (most recent):\n${traceSummary}\n\nDecide.`;

    const maxTokens = deps.maxOutputTokens ?? 256;
    const timeout = deps.timeoutMs ?? 8000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    if (typeof timer.unref === 'function') timer.unref();
    const effectiveSignal = signal ?? controller.signal;
    try {
        const raw = await deps.lmClient.generateText(
            `${REFLECTION_SYSTEM_PROMPT}\n\n${userPrompt}`,
            {maxTokens, signal: effectiveSignal},
        );
        return parseVerdict(raw) ?? FALLBACK;
    } catch {
        return FALLBACK;
    } finally {
        clearTimeout(timer);
    }
}

export function parseVerdict(raw: string): ReflectionVerdict | undefined {
    if (!raw) return undefined;
    const obj = extractJson(raw);
    if (!obj || typeof obj !== 'object') return undefined;
    const action = (obj as {action?: unknown}).action;
    if (action !== 'accept' && action !== 'revise' && action !== 'open_question') return undefined;
    const verdict: ReflectionVerdict = {action};
    const reasoning = (obj as {reasoning?: unknown}).reasoning;
    if (typeof reasoning === 'string') verdict.reasoning = reasoning;
    if (action === 'revise') {
        const stmt = (obj as {revisedStatement?: unknown}).revisedStatement;
        const truth = (obj as {revisedTruth?: unknown}).revisedTruth;
        if (typeof stmt === 'string') verdict.revisedStatement = stmt;
        if (truth && typeof truth === 'object') {
            const t = truth as {frequency?: unknown; confidence?: unknown};
            const f = typeof t.frequency === 'number' ? t.frequency : undefined;
            const c = typeof t.confidence === 'number' ? t.confidence : undefined;
            if (f !== undefined && c !== undefined) verdict.revisedTruth = {frequency: f, confidence: c};
        }
    } else if (action === 'open_question') {
        const q = (obj as {openQuestion?: unknown}).openQuestion;
        if (typeof q === 'string') verdict.openQuestion = q;
    }
    return verdict;
}

function extractJson(raw: string): unknown {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return undefined;
    const candidate = raw.slice(start, end + 1);
    try {
        return JSON.parse(candidate);
    } catch {
        return undefined;
    }
}

export function applyVerdict(
    verdict: ReflectionVerdict,
    deps: {workingMemory: WorkingMemory; nar?: NAR},
    artifactsSink: ReasoningArtifact[],
): void {
    if (verdict.action === 'revise' && verdict.revisedStatement) {
        const stmt = verdict.revisedStatement;
        const truth = verdict.revisedTruth;
        if (deps.nar) {
            const fullStatement = truth
                ? `${stmt} :|: truth=${truth.frequency}`
                : stmt;
            void deps.nar.input(fullStatement).catch(() => undefined);
        }
        artifactsSink.push({
            type: 'belief_added',
            content: stmt,
            timestamp: Date.now(),
            metadata: {toolName: 'reflect.revise', source: 'reflection-stage'},
        });
    } else if (verdict.action === 'open_question' && verdict.openQuestion) {
        deps.workingMemory.append('open_questions', verdict.openQuestion);
        artifactsSink.push({
            type: 'question_answered',
            content: verdict.openQuestion,
            timestamp: Date.now(),
            metadata: {toolName: 'reflect.open_question', source: 'reflection-stage'},
        });
    }
}
