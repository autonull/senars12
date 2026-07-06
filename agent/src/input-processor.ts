import type { NAR, Term } from '../../nar/src';
import { containsSubterm, termParser } from '../../nar/src';
import type {
  ContextAssembler,
  ContextAssemblerOpts,
  GenerationInput,
  NLGenerationService,
  NLUnderstandingService,
  TaskBatch,
} from '../../nar/src/nl';
import type { ParseTaskResult } from '../../nar/src/terms';
import type { ConversationSession } from './ConversationSession.js';
import { DEFAULT_SESSION_HISTORY_LIMIT, appendTurn, trimHistory } from './ConversationSession.js';
import { formatHistoryAsMessages } from './chat-history.js';

import type { AutonomyEngine } from './AutonomyEngine.js';

export interface InputProcessorDeps {
  nar: NAR | undefined;
  hasLmModel: boolean;
  understandingService: NLUnderstandingService | undefined;
  generationService: NLGenerationService | undefined;
  contextAssembler: ContextAssembler | undefined;
  contextOpts: ContextAssemblerOpts;
  autonomyEngine: AutonomyEngine | undefined;
}

export type InputEvent =
  | { kind: 'narsese-input'; text: string; taskType: string }
  | { kind: 'question-response'; text: string }
  | { kind: 'drive-adjusted'; text: string; driveId: string; amount: number }
  | { kind: 'nl-translated'; text: string }
  | {
      kind: 'lm-dispatch';
      text: string;
      usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    }
  | { kind: 'clarify'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'no-nar'; text: string };

export interface ProcessInputOpts {
  signal?: AbortSignal;
  session?: ConversationSession;
  historyLimit?: number;
}

function tryParseNarsese(input: string): ParseTaskResult | null {
  return termParser.parseTask(input);
}

function tryParseMultiNarsese(input: string): ParseTaskResult[] | null {
  const statements = input
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith(';;'));
  if (statements.length <= 1) return null;
  const results: ParseTaskResult[] = [];
  for (const stmt of statements) {
    const task = termParser.parseTask(stmt);
    if (!task) return null;
    results.push(task);
  }
  return results;
}

function formatTaskBatchResult(batch: TaskBatch): string {
  const parts: string[] = [];
  if (batch.beliefs.length > 0) {
    parts.push(`Recorded ${batch.beliefs.length} belief${batch.beliefs.length > 1 ? 's' : ''}:`);
    for (const b of batch.beliefs) {
      parts.push(`  + ${b.narsese}`);
    }
  }
  if (batch.questions.length > 0) {
    parts.push(`Asked ${batch.questions.length} question${batch.questions.length > 1 ? 's' : ''}.`);
  }
  if (batch.goals.length > 0) {
    parts.push(`Set ${batch.goals.length} goal${batch.goals.length > 1 ? 's' : ''}.`);
  }
  if (batch.meta.ambiguities.length > 0) {
    parts.push(
      `Detected ${batch.meta.ambiguities.length} ambiguity${batch.meta.ambiguities.length > 1 ? 'ies' : ''}.`
    );
  }
  return parts.join('\n') || 'Understood.';
}

function formatBelief(b: {
  term: { toString(): string };
  truth?: { f: number; c: number };
}): string {
  const truth = b.truth ? ` (f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)})` : '';
  return `${b.term.toString()}${truth}`;
}

async function generateReasonedResponse(
  generationService: NLGenerationService | undefined,
  input: string,
  beliefs: Array<{ term: { toString(): string }; truth?: { f: number; c: number } }>
): Promise<string | null> {
  if (!generationService || beliefs.length === 0) return null;
  try {
    const genInput: GenerationInput = {
      query: input,
      derivation: null,
      beliefs: beliefs.map((b) => ({
        term: b.term.toString(),
        truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined,
      })),
      conflicts: [],
    };
    const output = await generationService.generate(genInput);
    if (output.confidence > 0.3) return output.response;
  } catch {
    // generation failure is non-critical
  }
  return null;
}

async function tryNlTranslation(
  understandingService: NLUnderstandingService | undefined,
  generationService: NLGenerationService | undefined,
  nar: NAR | undefined,
  contextAssembler: ContextAssembler | undefined,
  contextOpts: ContextAssemblerOpts,
  input: string
): Promise<{ text: string; batch: TaskBatch } | { kind: 'clarify'; text: string } | null> {
  if (!understandingService || !nar) return null;
  try {
    const nlContext = contextAssembler?.assemble(nar, input, contextOpts);
    const batch = await understandingService.understand(input, nlContext);
    if (!batch) return null;

    if (batch.meta.ambiguities.length > 0) {
      const first = batch.meta.ambiguities[0];
      if (first) {
        const question = `I'm not sure about "${first.description}". ${first.options.join(' or ')}?`;
        return { kind: 'clarify', text: question };
      }
    }

    for (const b of batch.beliefs) {
      await nar.believe(b.narsese, b.truth as any);
    }
    for (const q of batch.questions) {
      await nar.question(q.narsese);
    }
    for (const g of batch.goals) {
      await nar.goal(g.narsese);
    }

    // Apply drive modulations from NL understanding
    const driveMods = batch.meta.driveModulations;
    if (driveMods) {
      const driveManager = nar.getDriveManager?.();
      if (driveManager) {
        for (const [driveId, amount] of Object.entries(driveMods)) {
          driveManager.stimulate(driveId, amount);
        }
      }
    }

    return { text: formatTaskBatchResult(batch), batch };
  } catch {
    return null;
  }
}

export async function* processInput(
  deps: InputProcessorDeps,
  input: string,
  opts: ProcessInputOpts = {}
): AsyncGenerator<InputEvent, string> {
  const {
    nar,
    hasLmModel,
    understandingService,
    generationService,
    contextAssembler,
    contextOpts,
    autonomyEngine,
  } = deps;
  const { session, historyLimit = DEFAULT_SESSION_HISTORY_LIMIT } = opts;

  // Pause background reasoning during user input processing
  autonomyEngine?.pause();

  try {
    // Multi-clause Narsese input: "sky is blue; sky is not green"
    const multiTask = tryParseMultiNarsese(input);
    if (multiTask) {
      const texts: string[] = [];
      for (const task of multiTask) {
        await nar?.input(task.term, task.taskType, task.truth);
        const text = task.term.toString();
        texts.push(text);
        yield { kind: 'narsese-input', text, taskType: task.taskType };
      }
      const joined = texts.join('; ');
      return `+ ${joined}`;
    }

    const task = tryParseNarsese(input);
    if (task) {
      await nar?.input(task.term, task.taskType, task.truth);
      if (task.taskType === 'question') {
        const existing = nar
          ?.getBeliefs()
          .find((b) => containsSubterm(b.term, task.term));
        if (existing) {
          const reasoned = await generateReasonedResponse(generationService, input, [
            existing as any,
          ]);
          const text = reasoned ?? formatBelief(existing as any);
          yield { kind: 'question-response', text };
          return text;
        }
        const text = `Question queued: ${input} (reasoning in background)`;
        yield { kind: 'question-response', text };
        return text;
      }
      const text = `+ ${input}`;
      yield { kind: 'narsese-input', text, taskType: task.taskType };
      return text;
    }

    if (nar && understandingService) {
      const nlResult = await tryNlTranslation(
        understandingService,
        generationService,
        nar,
        contextAssembler,
        contextOpts,
        input
      );
      if (nlResult !== null) {
        if ('kind' in nlResult && nlResult.kind === 'clarify') {
          yield { kind: 'clarify', text: nlResult.text };
          return nlResult.text;
        }
        if ('text' in nlResult && 'batch' in nlResult) {
          const batch = nlResult.batch;
          if (batch.meta.driveModulations) {
            const driveManager = nar.getDriveManager?.();
            if (driveManager) {
              for (const [driveId, amount] of Object.entries(batch.meta.driveModulations)) {
                driveManager.stimulate(driveId, amount);
                yield {
                  kind: 'drive-adjusted',
                  text: `Adjusted ${driveId} drive.`,
                  driveId,
                  amount,
                };
              }
            }
          }
          yield { kind: 'nl-translated', text: nlResult.text };
          return nlResult.text;
        }
      }
    }

    if (!hasLmModel) {
      const text = 'No LM configured — Narsese input only.';
      yield { kind: 'no-nar', text };
      return text;
    }

    let historyMessages:
      | Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
      | undefined;
    if (session) {
      historyMessages = formatHistoryAsMessages(session.history, historyLimit);
      historyMessages.push({ role: 'user', content: input });
    }

    // Signal to caller that LM dispatch is needed. The caller builds the
    // full composed request (system prompt, tools) and runs the model.
    yield { kind: 'lm-dispatch', text: '', usage: undefined };
    return '';
  } finally {
    // Resume background reasoning after processing
    autonomyEngine?.resume();
  }
}

export function appendSessionTurns(
  session: ConversationSession,
  input: string,
  response: string,
  historyLimit: number,
  metadata?: Record<string, unknown>
): void {
  appendTurn(session, 'user', input, metadata);
  appendTurn(session, 'assistant', response, metadata);
  trimHistory(session, historyLimit);
}
