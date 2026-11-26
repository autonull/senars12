/**
 * BotRuntime construction — assembles the shared state for `.command` surface.
 */

import type { AuthManager, CommandRegistry, ConnectionManager } from '@senars/io';
import type { ParameterLedger } from '@senars/config';
import type { DialogueCapture, RetrospectiveAdapter } from '@senars/dialogue';
import type { EmbeddingCache, JudgmentDataset, TraceGradeInput, TraceGradeResult } from '@senars/lm/system-one';
import type { MemoryQuery } from '@senars/query';
import type { ReadOnlyLookup } from '@senars/util/collections';
import type { ChatTier } from '@senars/cli';
import type { AttachedGame } from '@senars/cli/conversation-game';
import type { AppConfig, BotProfile } from '@senars/config';
import type { AgentFromEnvResult } from '../lib/lifecycle';
import { createLogger, type Logger } from '@senars/util/logger';
import { createMeTTa, parseMeTTa } from '@senars/metta';
import { MettaProposer } from '@senars/reflex';
import { reflexesOf } from '@senars/cli/conversation-game';
import { DEFAULT_MACRO_PIPELINE, createBudget, createCapturePhase } from '@senars/budget';
import { evaluateQuery } from '@senars/lm/system-one/head-ontology';
import { computeEvidenceId } from '@senars/lm/system-one/distill';
import { unique } from '@senars/util/collections';
import { makeId } from '@senars/util/id';
import { NLUnderstandingService, TranslationCache } from '@senars/nl';

const logger = createLogger({ scope: 'bot-runtime' });

/** Min grade score for a conversation to be auto-captured into the distillation dataset. */
const DISTILL_CAPTURE_THRESHOLD = 0.7;

export interface GroundednessState {
  enabled: boolean;
  threshold: number;
  gate: ((text: string, reputationKeys: readonly string[]) => Promise<boolean | { grounded: boolean; score?: number }>) | undefined;
}

export interface TraceState {
  enabled: boolean;
  sampleRate: number;
  grader: ((trace: TraceGradeInput) => Promise<TraceGradeResult>) | undefined;
  dataset?: JudgmentDataset;
  embeddingCache?: EmbeddingCache;
}

export interface SystemOneBag {
  readonly dataset?: JudgmentDataset;
  readonly traceGradeHistory?: ReadOnlyLookup<string, number>;
}

export type SystemOneHolder = { readonly systemOne?: SystemOneBag };

export const systemOneOf = (rt: { wired: { nar: unknown } }): SystemOneBag | undefined =>
  (rt.wired.nar as unknown as SystemOneHolder).systemOne;

export interface RoutingState {
  auto: boolean;
  policy: 'conservative' | 'balanced' | 'aggressive';
}

export interface ProvisionalState {
  enabled: boolean;
}

export interface ConnectSpec {
  readonly id: string;
  readonly type: string;
  readonly config: Record<string, unknown>;
}

export interface BotRuntime {
  readonly wired: AgentFromEnvResult;
  readonly cm: ConnectionManager;
  readonly auth: AuthManager;
  readonly registry: CommandRegistry;
  readonly dialogue: DialogueCapture;
  readonly memoryQuery: MemoryQuery;
  readonly strategyAdapter?: RetrospectiveAdapter;
  readonly parameterLedger?: ParameterLedger;
  readonly conversationGame: AttachedGame | null;
  readonly ground: GroundednessState;
  readonly trace: TraceState;
  readonly routing: RoutingState;
  readonly provisional: ProvisionalState;
  readonly profile: BotProfile;
  readonly tier: ChatTier;
  readonly secretIds: Set<string>;
  appConfig: AppConfig;
  webuiHandle: { close?: () => Promise<void> } | null;
  readonly attach: (spec: ConnectSpec) => Promise<string>;
}

/** Phase E: egress-gate verdicts are verification signals for the narration channel. */
export function narrationKeys(): string[] {
  let provider: string | undefined;
  try {
    const { resolveLMSettings } = require('@senars/lm');
    provider = resolveLMSettings().provider;
  } catch {
    provider = undefined;
  }
  const { providerKey } = require('@senars/kernel');
  const key = providerKey(provider);
  return key ? ['llm-narration', key] : ['llm-narration'];
}

/** Auto-capture a high-quality graded conversation into the distillation dataset. */
export async function captureDistillation(
  trace: TraceState,
  input: string,
  response: string,
  score: number,
  domain?: 'in-domain' | 'ood'
): Promise<void> {
  const { dataset, embeddingCache } = trace;
  if (!dataset || !embeddingCache || !response.trim()) return;
  try {
    const evidenceId = computeEvidenceId(input, response);
    const pointer = await embeddingCache.write(response);
    dataset.record(
      {
        evidenceId,
        rubric: 'groundedness',
        axis: 'epistemic',
        label: 'accepted',
        score,
        source: 'conversation',
        ...(domain ? { domain } : {}),
      },
      embeddingCache.read(pointer)
    );
  } catch {
    // Distillation capture is best-effort; never disrupt chat
  }
}

/** Build the groundedness gate state. */
export function buildGroundednessState(wired: AgentFromEnvResult): GroundednessState {
  const nar = wired.nar;
  const systemOneGate = nar.getSystemOneGroundednessGate?.();
  const { SourceReputation, DEFAULT_REPUTATION_PATH } = require('@senars/kernel');
  const sourceReputation = new SourceReputation({ path: DEFAULT_REPUTATION_PATH });
  nar.setSourceReputation(sourceReputation);

  return {
    enabled: wired.appConfig.systemOne?.enabled === true,
    threshold: 0.7,
    gate: systemOneGate
      ? async (text: string, reputationKeys: readonly string[]) => {
          const ok = await systemOneGate(text, makeId());
          for (const key of reputationKeys) {
            sourceReputation.record(key, ok ? 'confirmed' : 'contradicted');
          }
          return ok;
        }
      : undefined,
  };
}

/** Build the trace state. */
export function buildTraceState(wired: AgentFromEnvResult): TraceState {
  const nar = wired.nar;
  const embeddingCache = nar.getSystemOneEmbeddingCache?.();
  const systemOne: SystemOneBag | undefined = (nar as unknown as { systemOne?: SystemOneBag }).systemOne;

  return {
    enabled: false,
    sampleRate: 0.1,
    grader: nar.getSystemOneTraceGrader?.(),
    dataset: systemOne?.dataset,
    embeddingCache,
  };
}

/** Build the enrich function for dialogue capture. */
export function buildEnrich(
  wired: AgentFromEnvResult,
  conversationGame: AttachedGame | null,
  trace: TraceState
): ((input: { utterance: string; at?: number }) => Promise<unknown>) | undefined {
  const nar = wired.nar;
  const decider = nar.getSystemOneDecider?.();
  const embeddingCache = nar.getSystemOneEmbeddingCache?.();

  const understanding = wired.appConfig.dialogue?.captureAll === true
    ? new NLUnderstandingService(wired.lmService, new TranslationCache(), { structuredOnly: true })
    : undefined;

  if (!decider && !understanding) return undefined;

  return async (input: { utterance: string; at?: number }) => {
    const [result, batch] = await Promise.all([
      decider && embeddingCache
        ? decider.decide({
            context: input.utterance,
            queries: [evaluateQuery('groundedness', 'Evaluate groundedness of the dialogue turn')],
            budget: createBudget({ maxCycles: 10, maxDepth: 2, maxMemoryOps: 100, maxLMCalls: 0 }),
          })
        : null,
      understanding?.understandCandidates(input.utterance).catch(() => null) ?? null,
    ]);

    const since = input.at ?? 0;
    const windowed = reflexesOf(conversationGame).flatMap(
      (r) =>
        (r as { decisionsSince?(t: number): Array<{ proposed: string[]; selected?: unknown }> }).decisionsSince?.(since) ?? []
    );
    const selected = windowed.at(-1)?.selected;
    const vetoes = reflexesOf(conversationGame).find((r) => r.id === 'lm-reflex')?.contrastiveVetoes ?? 0;

    return {
      ...(result
        ? { judgment: { abstained: result.abstained, band: result.band }, provenance: result.provenance }
        : {}),
      ...(batch?.candidates?.length ? { formalizations: batch.candidates } : {}),
      ...(windowed.length && selected
        ? { reflex: { proposed: unique(windowed.flatMap((d) => d.proposed)), selected, vetoes } }
        : {}),
    };
  };
}

/** Attach ConversationGameFocus for System One reflexes. */
export async function attachConversationGame(
  nar: unknown,
  wired: AgentFromEnvResult
): Promise<AttachedGame | null> {
  if (!nar.isSystemOneEnabled?.()) return null;

  try {
    const mettaRuntime = createMeTTa();
    const evaluateMetta = (expression: string): boolean | null => {
      try {
        const { Effect } = require('effect');
        const atom = Effect.runSync(mettaRuntime.evaluate(parseMeTTa(expression)));
        return atom.kind === 0
          ? atom.value === 'True'
            ? true
            : atom.value === 'False'
              ? false
              : null
          : null;
      } catch {
        return null;
      }
    };

    const conversationGame = nar.attachConversationGame({
      id: 'conversation',
      lmReflex: true,
      proposers: [new MettaProposer(evaluateMetta, { toExpression: () => undefined })],
    });

    if (conversationGame) logger.info('ConversationGameFocus attached (not stepped)');

    // Seed CLM contrastive exemplars from live state
    nar.refreshSystemOneContrastive?.(wired.episodicMemory).catch((e) =>
      logger.warn('Contrastive refresh failed at startup', { error: (e as Error).message })
    );

    return conversationGame;
  } catch (e) {
    logger.warn('Failed to attach ConversationGameFocus', { error: (e as Error).message });
    return null;
  }
}

/** Build the dialogue capture instance. */
export function buildDialogueCapture(
  wired: AgentFromEnvResult,
  enrich: ((input: { utterance: string; at?: number }) => Promise<unknown>) | undefined,
  conversationGame: AttachedGame | null
): DialogueCapture {
  const nar = wired.nar;
  const { DialogueCapture } = require('@senars/dialogue');
  const { providerKey } = require('@senars/kernel');
  const { resolveLMSettings } = require('@senars/lm');

  const understanding = wired.appConfig.dialogue?.captureAll === true
    ? new NLUnderstandingService(wired.lmService, new TranslationCache(), { structuredOnly: true })
    : undefined;

  return new DialogueCapture({
    episodic: wired.episodicMemory,
    dataset: systemOneOf({ wired }).dataset,
    embeddingCache: nar.getSystemOneEmbeddingCache?.(),
    contrastive: nar.getSystemOneContrastive?.(),
    sourceKey: () => {
      try {
        const p = resolveLMSettings().provider;
        return p ? (providerKey(p) ?? 'user') : 'user';
      } catch {
        return 'user';
      }
    },
    ...(enrich ? { enrich: enrich as never } : {}),
    ...(understanding
      ? {
          formalize: (text: string) =>
            understanding
              .understandCandidates(text)
              .then((b) => (b?.candidates ?? []).map((c) => ({ narsese: c.narsese, confidence: c.confidence }))),
        }
      : {}),
    config: wired.appConfig.dialogue,
  });
}