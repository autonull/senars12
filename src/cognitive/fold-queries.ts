/**
 * Metacognitive Analyzers as Fold Queries — port analyzers to query the event log directly.
 *
 * Replaces direct NAR/self-host access with fold queries over the append-only log.
 * Counterfactual analysis → imagination faculty.
 */

import type { Episode } from '@senars/types/episodic-memory';
import type { Term } from '../kernel/terms';
import { fromNarsese } from '../kernel/terms';
import type { Truth } from '../kernel/truth';
import type { Concept } from '../memory/concept';
import type { ModelRuleStats } from '../lm';
import { flooredRatio } from '@senars/util/numeric';

// ============================================================================
// Types
// ============================================================================

/** Log entry for fold queries. */
export interface LogEntry {
  /** Entry type. */
  type: string;
  /** Timestamp. */
  timestamp: number;
  /** Iteration. */
  iteration: number;
  /** Payload. */
  payload: Record<string, unknown>;
}

/** Fold query context. */
export interface FoldQueryContext {
  /** Get all log entries. */
  getLog: () => LogEntry[];
  /** Get episodes. */
  getEpisodes: () => Episode[];
  /** Get concepts. */
  getConcepts: () => Concept[];
  /** Get rule stats. */
  getRuleStats: () => ModelRuleStats[] | null;
  /** Get beliefs. */
  getBeliefs: () => Array<{ term: Term; truth: Truth }>;
  /** Get goals. */
  getGoals: () => Array<{ term: Term; truth: Truth }>;
  /** Get questions. */
  getQuestions: () => Array<{ term: Term; truth: Truth }>;
}

/** Analyzer result. */
export interface AnalyzerResult<T> {
  /** Result data. */
  data: T;
  /** Query metadata. */
  meta: {
    queryName: string;
    timestamp: number;
    logVersion: number;
    entriesScanned: number;
  };
}

// ============================================================================
// Capability Analyzer
// ============================================================================

export interface CapabilitySnapshot {
  timestamp: number;
  activeRules: string[];
  activeTools: string[];
  lmProviders: string[];
  pipelineStages: string[];
  memoryState: { concepts: number; beliefs: number; episodes: number };
}

export interface CapabilityDiff {
  added: string[];
  removed: string[];
  changed: Array<{ name: string; before: string; after: string }>;
}

/** Fold query: get capability snapshot from log. */
export async function getCapabilitySnapshotFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<CapabilitySnapshot>> {
  const log = context.getLog();
  const concepts = context.getConcepts();
  const beliefs = context.getBeliefs();
  const episodes = context.getEpisodes();

  // Extract unique rules/tools from log
  const rulesSet = new Set<string>();
  const toolsSet = new Set<string>();
  const providersSet = new Set<string>();

  for (const entry of log) {
    if (entry.type === 'rule_applied') {
      rulesSet.add(entry.payload.rule as string);
    } else if (entry.type === 'tool_called') {
      toolsSet.add(entry.payload.tool as string);
    } else if (entry.type === 'lm_call') {
      providersSet.add(entry.payload.provider as string);
    }
  }

  const snapshot: CapabilitySnapshot = {
    timestamp: Date.now(),
    activeRules: [...rulesSet],
    activeTools: [...toolsSet],
    lmProviders: [...providersSet],
    pipelineStages: ['InputNormalizer', 'AuthChecker', 'SeNARSProcessor', 'LMResponder', 'ResponseComposer'],
    memoryState: {
      concepts: concepts.length,
      beliefs: beliefs.length,
      episodes: episodes.length,
    },
  };

  return {
    data: snapshot,
    meta: { queryName: 'capabilitySnapshot', timestamp: Date.now(), logVersion: log.length, entriesScanned: log.length },
  };
}

/** Fold query: diff capabilities between two log versions. */
export async function diffCapabilitiesFold(
  beforeLog: LogEntry[],
  afterLog: LogEntry[],
  beforeConcepts: Concept[],
  afterConcepts: Concept[],
  beforeBeliefs: Array<{ term: Term; truth: Truth }>,
  afterBeliefs: Array<{ term: Term; truth: Truth }>,
): Promise<CapabilityDiff> {
  const beforeRules = new Set<string>();
  const afterRules = new Set<string>();

  for (const entry of beforeLog) if (entry.type === 'rule_applied') beforeRules.add(entry.payload.rule as string);
  for (const entry of afterLog) if (entry.type === 'rule_applied') afterRules.add(entry.payload.rule as string);

  const added: string[] = [];
  const removed: string[] = [];

  for (const rule of afterRules) if (!beforeRules.has(rule)) added.push(rule);
  for (const rule of beforeRules) if (!afterRules.has(rule)) removed.push(rule);

  const changed: Array<{ name: string; before: string; after: string }> = [];

  if (afterConcepts.length !== beforeConcepts.length) {
    changed.push({ name: 'concepts', before: String(beforeConcepts.length), after: String(afterConcepts.length) });
  }
  if (afterBeliefs.length !== beforeBeliefs.length) {
    changed.push({ name: 'beliefs', before: String(beforeBeliefs.length), after: String(afterBeliefs.length) });
  }

  return { added, removed, changed };
}

// ============================================================================
// Performance Analyzer
// ============================================================================

export interface PerformancePatterns {
  ruleExecution: number;
  memoryUsage: number;
  throughput: 'stable' | 'increasing' | 'decreasing';
}

/** Fold query: analyze performance patterns from log. */
export async function analyzePerformancePatternsFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<PerformancePatterns>> {
  const log = context.getLog();
  const ruleStats = context.getRuleStats();

  // Average rule duration from stats
  let avgDuration = 0;
  if (ruleStats?.length) {
    avgDuration = ruleStats.reduce((sum, r) => sum + r.stats.averageDuration, 0) / ruleStats.length;
  }

  // Memory usage from log entries
  let memoryUsage = 0;
  let memEntries = 0;
  for (const entry of log) {
    if (entry.payload.memoryUsage) {
      memoryUsage += entry.payload.memoryUsage as number;
      memEntries++;
    }
  }
  if (memEntries > 0) memoryUsage /= memEntries;

  // Throughput: entries per iteration
  const iterations = new Set(log.map(e => e.iteration));
  const throughput = iterations.size > 0 ? log.length / iterations.size : 0;

  const patterns: PerformancePatterns = {
    ruleExecution: avgDuration,
    memoryUsage,
    throughput: throughput > 100 ? 'increasing' : throughput > 50 ? 'stable' : 'decreasing',
  };

  return {
    data: patterns,
    meta: { queryName: 'performancePatterns', timestamp: Date.now(), logVersion: log.length, entriesScanned: log.length },
  };
}

/** Fold query: identify successful strategies from rule stats. */
export async function identifySuccessfulStrategiesFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<string[]>> {
  const ruleStats = context.getRuleStats();
  let strategies: string[] = [];

  if (ruleStats?.length) {
    strategies = ruleStats
      .filter(r => r.stats.successfulCalls > 0)
      .sort((a, b) => b.stats.successRate - a.stats.successRate)
      .slice(0, 5)
      .map(r => r.id);
  }

  return {
    data: strategies,
    meta: { queryName: 'successfulStrategies', timestamp: Date.now(), logVersion: ruleStats?.length ?? 0, entriesScanned: ruleStats?.length ?? 0 },
  };
}

/** Fold query: analyze task processing patterns. */
export async function analyzeTaskPatternsFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<{ avgProcessingTime: number; queueDepth: number; dropRate: number }>> {
  const log = context.getLog();

  // Find task events
  const taskEvents = log.filter(e => e.type === 'task_processed' || e.type === 'task_dropped');
  const processed = taskEvents.filter(e => e.type === 'task_processed');
  const dropped = taskEvents.filter(e => e.type === 'task_dropped');

  let avgProcessingTime = 0;
  if (processed.length > 0) {
    avgProcessingTime = processed.reduce((sum, e) => sum + (e.payload.duration as number), 0) / processed.length;
  }

  const queueDepth = log.filter(e => e.type === 'task_queued').length;
  const dropRate = taskEvents.length > 0 ? dropped.length / taskEvents.length : 0;

  return {
    data: { avgProcessingTime, queueDepth, dropRate },
    meta: { queryName: 'taskPatterns', timestamp: Date.now(), logVersion: log.length, entriesScanned: taskEvents.length },
  };
}

// ============================================================================
// Resource Analyzer
// ============================================================================

export interface ResourceUsage {
  conceptCount: number;
  avgConceptPriority: number;
  memoryUsage: number;
  highPriorityConcepts: number;
  lowPriorityConcepts: number;
}

/** Fold query: analyze resource usage from concepts. */
export async function analyzeResourceUsageFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<ResourceUsage>> {
  const concepts = context.getConcepts();
  const priorities = concepts.map(c => c.priority);

  const memUsage = typeof process !== 'undefined' && process.memoryUsage
    ? process.memoryUsage()
    : { heapUsed: 0, heapTotal: 0 };

  const result: ResourceUsage = {
    conceptCount: concepts.length,
    avgConceptPriority: priorities.length > 0 ? priorities.reduce((a, b) => a + b, 0) / priorities.length : 0,
    memoryUsage: (memUsage.heapUsed + memUsage.heapTotal) / 2,
    highPriorityConcepts: concepts.filter(c => c.priority > 0.7).length,
    lowPriorityConcepts: concepts.filter(c => c.priority < 0.3).length,
  };

  return {
    data: result,
    meta: { queryName: 'resourceUsage', timestamp: Date.now(), logVersion: concepts.length, entriesScanned: concepts.length },
  };
}

// ============================================================================
// Term Pattern Analyzer
// ============================================================================

export interface TermPattern {
  term: string;
  frequency: number;
  coOccurrences: Map<string, number>;
  avgPriority: number;
  lastSeen: number;
}

/** Fold query: analyze term patterns from concepts. */
export async function analyzeTermPatternsFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<TermPattern[]>> {
  const concepts = context.getConcepts();

  const termFreq = new Map<string, { count: number; priorities: number[]; coOccurrences: Map<string, number> }>();

  for (const concept of concepts) {
    const termStr = concept.term.toString();
    const entry = termFreq.get(termStr) ?? { count: 0, priorities: [], coOccurrences: new Map<string, number>() };
    entry.count++;
    entry.priorities.push(concept.priority);
    termFreq.set(termStr, entry);
  }

  // Co-occurrences from log
  const log = context.getLog();
  for (const entry of log) {
    if (entry.type === 'terms_coactive') {
      const terms = entry.payload.terms as string[];
      for (let i = 0; i < terms.length; i++) {
        for (let j = i + 1; j < terms.length; j++) {
          const termI = terms[i]!;
          const termJ = terms[j]!;
          const entry1 = termFreq.get(termI);
          if (entry1) entry1.coOccurrences.set(termJ, (entry1.coOccurrences.get(termJ) ?? 0) + 1);
          const entry2 = termFreq.get(termJ);
          if (entry2) entry2.coOccurrences.set(termI, (entry2.coOccurrences.get(termI) ?? 0) + 1);
        }
      }
    }
  }

  const results: TermPattern[] = [];
  for (const [term, data] of termFreq) {
    if (data.count < 2) continue;
    const avgPriority = data.priorities.reduce((a, b) => a + b, 0) / data.priorities.length;
    results.push({
      term,
      frequency: data.count,
      coOccurrences: data.coOccurrences,
      avgPriority,
      lastSeen: Date.now(),
    });
  }

  results.sort((a, b) => b.frequency - a.frequency);

  return {
    data: results.slice(0, 50),
    meta: { queryName: 'termPatterns', timestamp: Date.now(), logVersion: log.length, entriesScanned: concepts.length },
  };
}

// ============================================================================
// Reasoning Pattern Analyzer
// ============================================================================

export interface InferenceChain {
  startTerm: string;
  endTerm: string;
  length: number;
  success: boolean;
  duration: number;
}

export interface PatternAnalysis {
  frequentPatterns: TermPattern[];
  inefficientChains: InferenceChain[];
  successfulStrategies: string[];
  performancePatterns: PerformancePatterns;
  resourceUsage: ResourceUsage;
  taskProcessingPatterns: { avgProcessingTime: number; queueDepth: number; dropRate: number };
}

/** Fold query: detect inefficient inference chains. */
export async function detectInefficientChainsFold(
  context: FoldQueryContext,
  maxDuration = 1000
): Promise<AnalyzerResult<InferenceChain[]>> {
  const log = context.getLog();

  // Look for derivation events with long durations
  const derivationEvents = log.filter(e => e.type === 'derivation' && (e.payload.duration as number) > maxDuration);

  const chains: InferenceChain[] = derivationEvents
    .map(e => ({
      startTerm: e.payload.startTerm as string,
      endTerm: e.payload.endTerm as string,
      length: e.payload.length as number,
      success: e.payload.success as boolean,
      duration: e.payload.duration as number,
    }))
    .slice(0, 10);

  return {
    data: chains,
    meta: { queryName: 'inefficientChains', timestamp: Date.now(), logVersion: log.length, entriesScanned: derivationEvents.length },
  };
}

/** Fold query: full pattern analysis. */
export async function analyzeReasoningPatternsFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<PatternAnalysis>> {
  const [
    patterns,
    chains,
    strategies,
    performance,
    resources,
    tasks,
  ] = await Promise.all([
    analyzeTermPatternsFold(context),
    detectInefficientChainsFold(context),
    identifySuccessfulStrategiesFold(context),
    analyzePerformancePatternsFold(context),
    analyzeResourceUsageFold(context),
    analyzeTaskPatternsFold(context),
  ]);

  return {
    data: {
      frequentPatterns: patterns.data,
      inefficientChains: chains.data,
      successfulStrategies: strategies.data,
      performancePatterns: performance.data,
      resourceUsage: resources.data,
      taskProcessingPatterns: tasks.data,
    },
    meta: { queryName: 'patternAnalysis', timestamp: Date.now(), logVersion: context.getLog().length, entriesScanned: context.getLog().length },
  };
}

// ============================================================================
// Policy Analyzer
// ============================================================================

export interface AgentPolicy {
  routingWeights: Record<string, number>;
  toolSelectionBias: Record<string, number>;
  promptBudget: number;
  recencyEpisodes: number;
  updatedAt: number;
}

/** Fold query: recompute policy from log. */
export async function recomputePolicyFold(
  context: FoldQueryContext,
  recencyEpisodes = 100
): Promise<AnalyzerResult<AgentPolicy>> {
  const log = context.getLog();
  const ruleStats = context.getRuleStats();

  const recentLog = log.slice(-recencyEpisodes);

  const routeCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();

  for (const entry of recentLog) {
    if (entry.type === 'route_selected') {
      routeCounts.set(entry.payload.kind as string, (routeCounts.get(entry.payload.kind as string) ?? 0) + 1);
    } else if (entry.type === 'tool_called') {
      toolCounts.set(entry.payload.tool as string, (toolCounts.get(entry.payload.tool as string) ?? 0) + 1);
    }
  }

  // Normalize to weights
  const totalRoutes = [...routeCounts.values()].reduce((a, b) => a + b, 0);
  const totalTools = [...toolCounts.values()].reduce((a, b) => a + b, 0);

  const routingWeights: Record<string, number> = {};
  for (const [kind, count] of routeCounts) routingWeights[kind] = count * flooredRatio(1, totalRoutes);

  const toolSelectionBias: Record<string, number> = {};
  for (const [tool, count] of toolCounts) toolSelectionBias[tool] = count * flooredRatio(1, totalTools);

  // Adjust by rule performance if available
  if (ruleStats) {
    for (const rule of ruleStats) {
      const weight = routingWeights[rule.id];
      if (weight !== undefined) {
        routingWeights[rule.id] = weight * (0.5 + rule.stats.successRate * 0.5);
      }
    }
  }

  return {
    data: {
      routingWeights,
      toolSelectionBias,
      promptBudget: 2048,
      recencyEpisodes,
      updatedAt: Date.now(),
    },
    meta: { queryName: 'recomputePolicy', timestamp: Date.now(), logVersion: log.length, entriesScanned: recentLog.length },
  };
}

// ============================================================================
// Quality Analyzer
// ============================================================================

export interface QualityAssessment {
  overall: number;
  coherence: number;
  relevance: number;
  completeness: number;
  timestamp: number;
}

/** Fold query: assess quality from log. */
export async function assessQualityFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<QualityAssessment>> {
  const beliefs = context.getBeliefs();
  const goals = context.getGoals();
  const questions = context.getQuestions();
  const log = context.getLog();

  // Coherence: contradiction events
  const contradictionEvents = log.filter(e => e.type === 'contradiction_detected').length;
  const coherence = Math.max(0, 1 - contradictionEvents * 0.1);

  // Relevance: belief-goal alignment
  let relevance = 0.5;
  if (goals.length > 0) {
    let relevant = 0;
    for (const goal of goals) {
      const goalSubject = extractSubject(goal.term);
      if (goalSubject) {
        const subjectTerm = fromNarsese(goalSubject);
        if (subjectTerm && beliefs.some(b => containsSubterm(b.term, subjectTerm))) {
          relevant++;
        }
      }
    }
    relevance = relevant / goals.length;
  }

  // Completeness: question resolution
  let completeness = 0.5;
  if (questions.length > 0) {
    let answered = 0;
    for (const q of questions) {
      if (beliefs.some(b => containsSubterm(b.term, q.term))) answered++;
    }
    completeness = answered / questions.length;
  }

  const overall = coherence * 0.4 + relevance * 0.3 + completeness * 0.3;

  return {
    data: { overall, coherence, relevance, completeness, timestamp: Date.now() },
    meta: { queryName: 'qualityAssessment', timestamp: Date.now(), logVersion: log.length, entriesScanned: log.length },
  };
}

// ============================================================================
// Corrections Analyzer
// ============================================================================

export interface IdentifiedIssues {
  contradictions: Array<{ type: string; severity: string; value: number; description: string }>;
  inefficiencies: Array<{ type: string; severity: string; value: number; description: string }>;
  resourceIssues: Array<{ type: string; severity: string; value: number; description: string }>;
  performanceIssues: Array<{ type: string; severity: string; value: number; description: string }>;
}

/** Fold query: identify issues from log. */
export async function identifyIssuesFold(
  context: FoldQueryContext
): Promise<AnalyzerResult<IdentifiedIssues>> {
  const concepts = context.getConcepts();
  const log = context.getLog();

  const issues: IdentifiedIssues = {
    contradictions: [],
    inefficiencies: [],
    resourceIssues: [],
    performanceIssues: [],
  };

  // Resource issues
  const lowPriorityRatio = concepts.filter(c => c.priority < 0.2).length * flooredRatio(1, concepts.length);
  if (lowPriorityRatio > 0.5) {
    issues.resourceIssues.push({
      type: 'high_low_priority_ratio',
      severity: 'medium',
      value: lowPriorityRatio,
      description: 'Over 50% of concepts have low priority',
    });
  }

  if (concepts.length > 100) {
    issues.resourceIssues.push({
      type: 'high_concept_count',
      severity: 'high',
      value: concepts.length,
      description: 'Concept count exceeds recommended limit',
    });
  }

  // Performance issues
  const ruleStats = context.getRuleStats();
  if (ruleStats) {
    const avgDuration = ruleStats.reduce((sum, r) => sum + r.stats.averageDuration, 0) / ruleStats.length;
    if (avgDuration > 5000) {
      issues.performanceIssues.push({
        type: 'high_avg_duration',
        severity: 'high',
        value: avgDuration,
        description: 'Average rule duration exceeds 5 seconds',
      });
    }
  }

  // Inefficiencies from chains
  const chains = await detectInefficientChainsFold(context);
  if (chains.data.length > 0) {
    issues.inefficiencies.push({
      type: 'inefficient_chains',
      severity: 'medium',
      value: chains.data.length,
      description: `${chains.data.length} inefficient inference chains detected`,
    });
  }

  // Contradictions from log
  const contradictionEvents = log.filter(e => e.type === 'contradiction_detected');
  for (const e of contradictionEvents) {
    issues.contradictions.push({
      type: 'contradiction',
      severity: 'high',
      value: 1,
      description: e.payload.description as string ?? 'Contradiction detected',
    });
  }

  return {
    data: issues,
    meta: { queryName: 'identifyIssues', timestamp: Date.now(), logVersion: log.length, entriesScanned: log.length },
  };
}

// ============================================================================
// Counterfactual → Imagination Faculty
// ============================================================================

export interface CounterfactualScenario {
  /** Scenario ID. */
  id: string;
  /** Description. */
  description: string;
  /** Premise (what if...). */
  premise: string;
  /** Predicted outcomes. */
  outcomes: Array<{ term: string; probability: number; utility: number }>;
  /** Confidence. */
  confidence: number;
}

/** Fold query: generate counterfactual scenarios (delegates to imagination faculty). */
export async function generateCounterfactualsFold(
  context: FoldQueryContext,
  premise: string,
  maxScenarios = 5
): Promise<AnalyzerResult<CounterfactualScenario[]>> {
  const log = context.getLog();
  const concepts = context.getConcepts();

  // Extract relevant concepts for the premise
  const relevantConcepts = concepts
    .filter(c => c.term.toString().includes(premise) || premise.includes(c.term.toString()))
    .slice(0, 10);

  // Generate scenarios by exploring alternative paths in the log
  const scenarios: CounterfactualScenario[] = [];

  // Find similar past situations
  const similarEpisodes = log
    .filter(e => e.type === 'episode' && JSON.stringify(e.payload).includes(premise))
    .slice(0, maxScenarios);

  for (let i = 0; i < Math.min(maxScenarios, similarEpisodes.length); i++) {
    const episode = similarEpisodes[i]!;
    const outcomes = (episode.payload.outcomes as Array<{ term: string; probability: number; utility: number }>) ?? [];

    scenarios.push({
      id: `cf-${Date.now()}-${i}`,
      description: `Counterfactual: ${premise} (based on episode ${episode.payload.id})`,
      premise,
      outcomes,
      confidence: 0.6 + i * 0.05,
    });
  }

  // If no similar episodes, generate from concept combinations
  if (scenarios.length === 0 && relevantConcepts.length > 0) {
    for (let i = 0; i < Math.min(maxScenarios, relevantConcepts.length); i++) {
      const c = relevantConcepts[i]!;
      scenarios.push({
        id: `cf-${Date.now()}-${i}`,
        description: `What if ${premise} leads to ${c.term}?`,
        premise,
        outcomes: [{ term: c.term.toString(), probability: 0.5, utility: c.priority }],
        confidence: 0.4,
      });
    }
  }

  return {
    data: scenarios,
    meta: { queryName: 'counterfactuals', timestamp: Date.now(), logVersion: log.length, entriesScanned: log.length },
  };
}

// ============================================================================
// Helper functions
// ============================================================================

function extractSubject(term: Term): string | null {
  const str = term.toString();
  const match = str.match(/<(.*?)\s/);
  return match?.[1] ?? null;
}

function containsSubterm(haystack: Term, needle: Term): boolean {
  return haystack.toString().includes(needle.toString());
}