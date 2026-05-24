import type {NAR} from '../nar/nar.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {ConversationState} from './ConversationState.js';
import type {BotConfig} from './BotContext.js';

export interface SelfAnalysisConfig {
  enabled: boolean;
  analysisInterval: number; // Number of turns between analyses
  autoImprove: boolean;
  maxImprovements: number;
}

export interface SelfAnalysisState {
  turnCount: number;
  lastAnalysisTurn: number;
  totalFailures: number;
  totalSuccesses: number;
  patterns: string[];
  lastReport?: AnalysisReport;
}

export interface AnalysisReport {
  timestamp: number;
  turnCount: number;
  successRate: number;
  topPatterns: string[];
  failurePoints: string[];
  recommendations: string[];
  knowledgeGaps: {
    missingRules: string[];
    lowConfidenceBeliefs: Array<{term: string; f: number; c: number}>;
    repeatedFailures: string[];
  };
  coverage: {
    coveredConcepts: number;
    totalConcepts: number;
    coveragePercent: number;
    uncoveredDomains: string[];
  };
}

export class SelfAnalysisManager {
  private readonly nar: NAR;
  private readonly episodicMemory?: EpisodicMemory;
  private readonly config: SelfAnalysisConfig;
  private state: SelfAnalysisState;

  constructor(
    nar: NAR,
    episodicMemory?: EpisodicMemory,
    config: Partial<SelfAnalysisConfig> = {}
  ) {
    this.nar = nar;
    this.episodicMemory = episodicMemory;
    this.config = {
      enabled: true,
      analysisInterval: 10,
      autoImprove: false,
      maxImprovements: 3,
      ...config,
    };
    this.state = {
      turnCount: 0,
      lastAnalysisTurn: -1,
      totalFailures: 0,
      totalSuccesses: 0,
      patterns: [],
    };
  }

  async recordTurn(success: boolean, feedback?: string): Promise<void> {
    if (success) {
      this.state.totalSuccesses++;
    } else {
      this.state.totalFailures++;
      if (feedback) {
        await this.episodicMemory?.log('error', feedback, {
          turn: this.state.turnCount,
        });
      }
    }
    this.state.turnCount++;
  }

  async shouldAnalyze(): Promise<boolean> {
    if (!this.config.enabled) return false;
    return this.state.turnCount - this.state.lastAnalysisTurn >= this.config.analysisInterval;
  }

  async analyze(): Promise<AnalysisReport> {
    const successRate = this.state.totalSuccesses / Math.max(1, this.state.totalSuccesses + this.state.totalFailures);

    const concepts = this.nar.listConcepts();
    const beliefs = this.nar.getBeliefs();

    const report: AnalysisReport = {
      timestamp: Date.now(),
      turnCount: this.state.turnCount,
      successRate,
      topPatterns: this.state.patterns,
      failurePoints: [],
      recommendations: [],
      knowledgeGaps: {
        missingRules: [],
        lowConfidenceBeliefs: beliefs.filter(b => b.truth && b.truth.c < 0.5).map(b => ({
          term: b.term.toString(),
          f: b.truth?.f ?? 0,
          c: b.truth?.c ?? 0
        })),
        repeatedFailures: [],
      },
      coverage: {
        coveredConcepts: concepts.length,
        totalConcepts: concepts.length,
        coveragePercent: 100,
        uncoveredDomains: [],
      },
    };

    this.state.lastReport = report;
    this.state.lastAnalysisTurn = this.state.turnCount;

    await this.episodicMemory?.log('response', `Analysis Report: Success rate: ${(successRate * 100).toFixed(1)}%, Failures: ${this.state.totalFailures}`, {
      turn: this.state.turnCount,
    });

    return report;
  }

  async proposeImprovements() {
    return [];
  }

  getState(): SelfAnalysisState {
    return {...this.state};
  }

  getLastReport(): AnalysisReport | undefined {
    return this.state.lastReport;
  }

  async generateSummary(): Promise<string> {
    const parts: string[] = [];
    
    parts.push(`## Self-Analysis Summary`);
    parts.push(`- Turns: ${this.state.turnCount}`);
    const successRate = this.state.totalSuccesses / Math.max(1, this.state.totalSuccesses + this.state.totalFailures);
    parts.push(`- Success Rate: ${(successRate * 100).toFixed(1)}%`);
    parts.push(`- Total Failures: ${this.state.totalFailures}`);
    
    if (this.state.lastReport) {
      const {lastReport} = this.state;
      parts.push(`- Top Pattern: ${lastReport.topPatterns[0] ?? 'None'}`);
      parts.push(`- Knowledge Coverage: ${lastReport.coverage.coveragePercent.toFixed(1)}%`);
    }

    return parts.join('\n');
  }
}
