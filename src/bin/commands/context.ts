/**
 * Shared state for the bot's `.command` surface.
 *
 * `buildBotCommands` receives one `BotRuntime` instead of a dozen positional
 * parameters, and each command group reads only the slices it declares here.
 * Mutable fields are exactly the ones the commands intentionally mutate.
 */

import type { AuthManager, CommandRegistry, ConnectionManager } from '@senars/io';
import type { ParameterLedger } from '@senars/nar/config';
import type { DialogueCapture, RetrospectiveAdapter } from '@senars/nar/dialogue';
import type { JudgmentDataset } from '@senars/nar/lm/system-one/distill.js';
import type { TraceGradeInput, TraceGradeResult } from '@senars/nar/lm/system-one/trace-grader.js';
import type { EmbeddingCache } from '@senars/nar/lm/system-one/types.js';
import type { MemoryQuery } from '@senars/nar/query/memory-query.js';
import type { AppConfig, BotProfile } from '../../config/index.js';
import type { AttachedGame } from '../../cli/conversation-game.js';
import type { ChatTier } from '../../cli/commands.js';
import type { AgentFromEnvResult } from '../lib/lifecycle.js';

export interface GroundednessState {
  enabled: boolean;
  threshold: number;
  gate: ((text: string) => Promise<boolean | { grounded: boolean; score?: number }>) | undefined;
}

export interface TraceState {
  enabled: boolean;
  sampleRate: number;
  grader: ((trace: TraceGradeInput) => Promise<TraceGradeResult>) | undefined;
  dataset?: JudgmentDataset | undefined;
  embeddingCache?: EmbeddingCache | undefined;
}

/**
 * The System One subsystem NAR attaches lazily. The bot only ever reads these
 * optional members, so one structural view replaces per-call-site casts.
 */
export interface SystemOneBag {
  readonly dataset?: JudgmentDataset;
  readonly traceGradeHistory?: ReadonlyMap<string, number>;
}

export type SystemOneHolder = { readonly systemOne?: SystemOneBag };

/** The attached System One bag, or `undefined` when System One is not enabled. */
export const systemOneOf = (rt: BotRuntime): SystemOneBag | undefined =>
  (rt.wired.nar as unknown as SystemOneHolder).systemOne;

export interface RoutingState {
  auto: boolean;
  policy: 'conservative' | 'balanced' | 'aggressive';
}

export interface ProvisionalState {
  enabled: boolean;
}

/** Connection spec accepted by the runtime's `attach`. */
export interface ConnectSpec {
  readonly id: string;
  readonly type: string;
  readonly config: Record<string, unknown>;
}

export interface BotRuntime {
  readonly wired: AgentFromEnvResult;
  readonly cm: ConnectionManager;
  readonly auth: AuthManager;
  /** Remote-transport command registry, shared by every attached connection. */
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
  /** Profile captured at startup — commands that rewrite config do not rebind it. */
  readonly profile: BotProfile;
  readonly tier: ChatTier;
  readonly secretIds: Set<string>;
  /** Replaced wholesale by `.config-reload` / `.s1-config reload`. */
  appConfig: AppConfig;
  webuiHandle: { close?: () => Promise<void> } | null;
  readonly attach: (spec: ConnectSpec) => Promise<string>;
}
