/**
 * UI Contract — generated protocol types from genome.
 *
 * Verified by schema:drift gate; UI packages typecheck against this.
 */

import type { Term, CompoundTerm } from '../kernel/terms';
import { TermOp } from '../kernel/terms';
import type { TruthValue } from '../kernel/truth';
import type { Stamp } from '../kernel/types';

/** UI contract version. */
export const UI_CONTRACT_VERSION = '1.0.0';

/** Artifact for UI. */
export interface UIArtifact {
  /** Artifact ID. */
  id: string;
  /** Kind. */
  kind: 'belief' | 'skill' | 'faculty' | 'rule' | 'plan' | 'concept';
  /** Term (serialized). */
  term: UITerm;
  /** Truth. */
  truth: TruthValue;
  /** Status. */
  status: 'candidate' | 'admitted' | 'demoted' | 'retired' | 'quarantined';
  /** Tags. */
  tags: string[];
  /** Metrics. */
  metrics: UIArtifactMetrics;
  /** Timestamp. */
  timestamp: number;
}

/** UI term (serialized). */
export type UITerm =
  | { type: 'constant'; value: string }
  | { type: 'variable'; name: string }
  | { type: 'compound'; operator: string; args: UITerm[] }
  | { type: 'inheritance'; subject: UITerm; predicate: UITerm }
  | { type: 'similarity'; left: UITerm; right: UITerm }
  | { type: 'implication'; antecedent: UITerm; consequent: UITerm }
  | { type: 'conjunction'; terms: UITerm[] }
  | { type: 'disjunction'; terms: UITerm[] }
  | { type: 'negation'; term: UITerm }
  | { type: 'statement'; term: UITerm; punctuation: '.' | '?' | '!' };

/** UI artifact metrics. */
export interface UIArtifactMetrics {
  usageCount: number;
  successRate: number;
  avgUtility: number;
  lastUsed: number;
  confidenceTrend: number;
}

/** Habitat for UI. */
export interface UIHabitat {
  id: string;
  name: string;
  kind: string;
  seed: number;
  maxSteps: number;
  state: UIHabitatState;
}

/** UI habitat state. */
export interface UIHabitatState {
  step: number;
  episode: number;
  entities: Record<string, UIEntity>;
  agent: UIAgentState;
  env: Record<string, unknown>;
}

/** UI entity. */
export interface UIEntity {
  type: string;
  position?: { x: number; y: number };
  properties: Record<string, unknown>;
  active: boolean;
}

/** UI agent state. */
export interface UIAgentState {
  position?: { x: number; y: number };
  inventory: string[];
  energy: number;
  internal: Record<string, unknown>;
}

/** Scorecard for UI. */
export interface UIScorecard {
  targetId: string;
  targetKind: 'habitat' | 'pack';
  metrics: UIScorecardMetrics;
  timestamp: number;
  seed: number;
}

/** UI scorecard metrics. */
export interface UIScorecardMetrics {
  meanReward: number;
  stdReward: number;
  meanSteps: number;
  successRate: number;
  fairnessViolations: number;
  laneDistribution: Record<string, number>;
}

/** Curriculum for UI. */
export interface UICurriculum {
  id: string;
  name: string;
  items: UICurriculumItem[];
}

/** UI curriculum item. */
export interface UICurriculumItem {
  id: string;
  kind: string;
  term: UITerm;
  expectedTruth: TruthValue;
  source: 'proof' | 'countermodel' | 'certificate' | 'exploration';
  difficulty: number;
  prerequisites: string[];
  tags: string[];
}

/** MCP tool for UI. */
export interface UIMCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, UIJSONSchemaProperty>;
    required: string[];
  };
}

/** UI JSON schema property. */
export interface UIJSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: unknown[];
  items?: UIJSONSchemaProperty;
  properties?: Record<string, UIJSONSchemaProperty>;
  required?: string[];
}

/** UI MCP resource. */
export interface UIMCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** UI MCP prompt. */
export interface UIMCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

/** Protocol message. */
export type UIProtocolMessage =
  | { type: 'artifact_list'; artifacts: UIArtifact[] }
  | { type: 'artifact_get'; artifact: UIArtifact | null }
  | { type: 'artifact_admit'; artifact: UIArtifact }
  | { type: 'artifact_update'; artifact: UIArtifact }
  | { type: 'artifact_remove'; artifactId: string }
  | { type: 'habitat_list'; habitats: UIHabitat[] }
  | { type: 'habitat_state'; state: UIHabitatState }
  | { type: 'scorecard'; scorecard: UIScorecard }
  | { type: 'curriculum_list'; curricula: UICurriculum[] }
  | { type: 'tool_list'; tools: UIMCPTool[] }
  | { type: 'resource_list'; resources: UIMCPResource[] }
  | { type: 'prompt_list'; prompts: UIMCPPrompt[] }
  | { type: 'error'; code: number; message: string }
  | { type: 'ping' }
  | { type: 'pong' };

/** Convert kernel term to UI term. */
export function termToUI(term: Term): UITerm {
  if (term.op === TermOp.CONSTANT) {
    return { type: 'constant', value: term.value };
  }
  if (term.op === TermOp.VARIABLE) {
    return { type: 'variable', name: term.name };
  }
  // Compound term (any op except VARIABLE and CONSTANT)
  const compound = term as CompoundTerm;
  return {
    type: 'compound',
    operator: compound.op,
    args: compound.args.map(termToUI),
  };
}

/** Convert UI term to kernel term (best effort). */
export function uiToTerm(ui: UITerm): Term {
  // In real implementation, use term interner
  return { op: TermOp.CONSTANT, value: JSON.stringify(ui) } as Term;
}