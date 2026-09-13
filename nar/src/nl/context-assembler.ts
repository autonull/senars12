import type { NAR } from '../nar.js';
import { TermSet } from '../terms';
import type { TranslationCache, TranslationCacheEntry } from './cache.js';
import type { NLContext } from './understanding.js';

export interface ContextAssemblerOpts {
  tokenBudget?: number;
  maxBeliefs?: number;
  maxDerivations?: number;
  maxGoals?: number;
  maxExamples?: number;
}

export interface ContextAssemblerOpts {
  tokenBudget?: number;
  maxBeliefs?: number;
  maxDerivations?: number;
  maxGoals?: number;
  maxExamples?: number;
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
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
    const ratio = availableBudget / currentTokens;
    return {
      beliefs: this.pruneArray(
        context.beliefs ?? [],
        Math.max(1, Math.floor((context.beliefs ?? []).length * ratio))
      ),
      recentDerivations: this.pruneArray(
        context.recentDerivations ?? [],
        Math.max(1, Math.floor((context.recentDerivations ?? []).length * ratio))
      ),
      memoryHealth: context.memoryHealth,
      activeGoals: this.pruneArray(
        context.activeGoals ?? [],
        Math.max(1, Math.floor((context.activeGoals ?? []).length * ratio))
      ),
      recentExamples: this.pruneArray(
        context.recentExamples ?? [],
        Math.max(1, Math.floor((context.recentExamples ?? []).length * ratio))
      ),
    };
  }

  private pruneArray<T>(arr: T[], maxLen: number): T[] {
    return arr.slice(0, maxLen);
  }

  private extractRelatedBeliefs(nar: NAR, input: string, max: number): string[] {
    const allBeliefs = nar.getBeliefs();
    const words = new Set(input.toLowerCase().split(/\s+/));

    const scored = allBeliefs.map((b) => {
      const term = b.term.toString().toLowerCase();
      const termWords = new Set(term.split(/\s+/));
      let overlap = 0;
      for (const w of words) {
        if (termWords.has(w)) overlap++;
      }
      // Handle mock NARs that may not have getConcept
      let attentionPriority = 0;
      if (typeof nar.getConcept === 'function') {
        const concept = nar.getConcept(b.term);
        attentionPriority = concept?.priority ?? 0;
      }
      // Score formula: overlapScore * 0.4 + attentionPriority * 0.6
      const overlapScore = overlap / Math.max(1, words.size);
      const score = overlapScore * 0.4 + attentionPriority * 0.6;
      return { term: b.term.toString(), truth: b.truth, score };
    });

    return scored
      .filter((b) => b.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((b) => {
        const truth = b.truth ? ` :${b.truth.f.toFixed(2)}:${b.truth.c.toFixed(2)}` : '';
        return `${b.term}${truth}`;
      });
  }

  private extractRecentDerivations(nar: NAR, max: number): string[] {
    const beliefs = nar.getBeliefs();

    // Quality filter: confidence > 0.5, frequency > 0.1
    // Deduplicate by term
    const seen = new TermSet();
    const filtered = beliefs
      .filter((b) => {
        if (!b.truth) return false;
        if (b.truth.c <= 0.5) return false;
        if (b.truth.f <= 0.1) return false;
        if (seen.has(b.term)) return false;
        seen.add(b.term);
        return true;
      })
      .slice(-max);

    return filtered.map((b) => {
      const truth = b.truth ? ` :${b.truth.f.toFixed(2)}:${b.truth.c.toFixed(2)}` : '';
      return `${b.term.toString()}${truth}`;
    });
  }

  private extractActiveGoals(nar: NAR, max: number): string[] {
    const goals = nar.getGoals();
    return goals.slice(0, max).map((g) => g.term.toString());
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
