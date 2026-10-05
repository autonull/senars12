import {
  flooredRatio,
  formatNarseseTruth,
  overlapCount,
  safeRatio,
  selectTopN,
  shareCount,
  takeFirst,
  takeLast,
  tokenizeWords,
  uniqueBy,
} from '@senars/util';

import { estimateTokens } from '../lm/context/context-budget.js';
import type { NAR } from '../nar.js';
import { termKey } from '../terms';
import type { TranslationCache, TranslationCacheEntry } from './cache.js';
import type { NLContext } from './understanding.js';

export interface ContextAssemblerOpts {
  tokenBudget?: number;
  maxBeliefs?: number;
  maxDerivations?: number;
  maxGoals?: number;
  maxExamples?: number;
}

export class ContextAssembler {
  private cache: TranslationCache;

  constructor(cache: TranslationCache) {
    this.cache = cache;
  }

  assemble(nar: NAR, input: string, opts: ContextAssemblerOpts = {}): NLContext {
    const {
      maxBeliefs = 15,
      maxDerivations = 5,
      maxGoals = 5,
      maxExamples = 3,
      tokenBudget = 4096,
    } = opts;

    const beliefs = this.extractRelatedBeliefs(nar, input, maxBeliefs);
    const recentDerivations = this.extractRecentDerivations(nar, maxDerivations);
    const activeGoals = this.extractActiveGoals(nar, maxGoals);
    const memoryHealth = this.extractMemoryHealth(nar);
    const recentExamples = this.extractRelevantExamples(input, maxExamples);

    // Token budget management
    const assembled: NLContext = {
      beliefs: beliefs ?? [],
      recentDerivations: recentDerivations ?? [],
      memoryHealth,
      activeGoals: activeGoals ?? [],
      recentExamples: recentExamples ?? [],
    };

    // Prune proportionally if over budget
    return this.pruneToTokenBudget(assembled, tokenBudget, input);
  }

  private pruneToTokenBudget(context: NLContext, tokenBudget: number, input: string): NLContext {
    const inputTokens = estimateTokens(input);
    const availableBudget = tokenBudget - inputTokens - 500; // Reserve tokens for response

    if (availableBudget <= 0) {
      return {
        beliefs: [],
        recentDerivations: [],
        memoryHealth: context.memoryHealth,
        activeGoals: [],
        recentExamples: [],
      };
    }

    // Calculate current token usage
    const beliefsText = (context.beliefs ?? []).join('\n');
    const derivationsText = (context.recentDerivations ?? []).join('\n');
    const goalsText = (context.activeGoals ?? []).join('\n');
    const examplesText = (context.recentExamples ?? []).map((e) => e.nl).join('\n');

    const currentTokens =
      estimateTokens(beliefsText) +
      estimateTokens(derivationsText) +
      estimateTokens(goalsText) +
      estimateTokens(examplesText);

    if (currentTokens <= availableBudget) {
      return context;
    }

    // Prune proportionally
    const ratio = safeRatio(availableBudget, currentTokens);
    const prune = <T>(items: T[] = []): T[] => items.slice(0, shareCount(items.length, ratio));
    return {
      beliefs: prune(context.beliefs),
      recentDerivations: prune(context.recentDerivations),
      memoryHealth: context.memoryHealth,
      activeGoals: prune(context.activeGoals),
      recentExamples: prune(context.recentExamples),
    };
  }

  private extractRelatedBeliefs(nar: NAR, input: string, max: number): string[] {
    const allBeliefs = nar.getBeliefs();
    const words = tokenizeWords(input);

    const scored = allBeliefs.map((b) => {
      const term = b.term.toString();
      const overlap = overlapCount(words, tokenizeWords(term));
      // Handle mock NARs that may not have getConcept
      const attentionPriority =
        typeof nar.getConcept === 'function' ? (nar.getConcept(b.term)?.priority ?? 0) : 0;
      // Score formula: overlapScore * 0.4 + attentionPriority * 0.6
      return {
        term,
        truth: b.truth,
        score: flooredRatio(overlap, words.size) * 0.4 + attentionPriority * 0.6,
      };
    });

    return selectTopN(
      scored.filter((b) => b.score > 0),
      max,
      (b) => b.score
    ).map((b) => `${b.term}${formatNarseseTruth(b.truth)}`);
  }

  private extractRecentDerivations(nar: NAR, max: number): string[] {
    const beliefs = nar.getBeliefs();

    // Quality filter: confidence > 0.5, frequency > 0.1
    const filtered = uniqueBy(
      beliefs.filter((b) => b.truth !== undefined && b.truth.c > 0.5 && b.truth.f > 0.1),
      (b) => termKey(b.term)
    );

    return takeLast(filtered, max).map((b) => `${b.term.toString()}${formatNarseseTruth(b.truth)}`);
  }

  private extractActiveGoals(nar: NAR, max: number): string[] {
    const goals = nar.getGoals();
    return takeFirst(goals, max).map((g) => g.term.toString());
  }

  private extractMemoryHealth(nar: NAR): { pressure: number; totalConcepts: number } {
    const stats = nar.getStatistics();
    return {
      pressure: stats.memoryPressure,
      totalConcepts: stats.totalConcepts,
    };
  }

  private extractRelevantExamples(input: string, max: number): TranslationCacheEntry[] {
    return this.cache.getRelevant(input, max);
  }
}
