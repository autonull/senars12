/**
 * Engine Interface — unified interface for SLD/SMT/ASP/Prolog engines.
 *
 * Provides a common API for different reasoning engines with
 * engine-specific configuration and result handling.
 */

import { Formula, Model, CNFFormula, QueryResult, EngineConfig, EngineType, ProofCertificate } from './ast.js';
import { SLDResolver, createSLDResolver, SLDConfig, SLDResult } from './sld.js';
import { ModelFinder, createModelFinder, ModelFinderConfig, ModelResult } from './models.js';
import { MUSExtractor, createMUSExtractor, MUSConfig } from './mus.js';
import { CertificateGenerator, createCertificateGenerator, CertificateVerifier, createCertificateVerifier } from './certificates.js';
import type { Clock } from '../../kernel/env.js';
import { createDefaultClock } from '../../kernel/env.js';

/** Unified engine interface. */
export interface ReasoningEngine {
  readonly type: EngineType;
  readonly name: string;

  /** Check satisfiability. */
  checkSat(formula: Formula): Promise<QueryResult>;

  /** Find models. */
  findModels(formula: Formula, maxModels?: number): Promise<Model[]>;

  /** Prove theorem (return proof certificate). */
  prove(theorem: Formula): Promise<ProofCertificate | null>;

  /** Extract MUS if unsatisfiable. */
  extractMUS(formula: Formula): Promise<{ clauses: readonly import('./ast.js').Clause[] } | null>;

  /** Get engine statistics. */
  getStatistics(): EngineStatistics;
}

/** Engine statistics. */
export interface EngineStatistics {
  queries: number;
  totalTimeMs: number;
  satCalls: number;
  unsatCalls: number;
  unknownCalls: number;
}

/** Engine factory. */
export class EngineFactory {
  private engines = new Map<EngineType, ReasoningEngine>();

  /** Register an engine. */
  register(engine: ReasoningEngine): void {
    this.engines.set(engine.type, engine);
  }

  /** Get engine by type. */
  get(type: EngineType): ReasoningEngine | undefined {
    return this.engines.get(type);
  }

  /** Get default engine for a formula. */
  getDefault(formula: Formula): ReasoningEngine {
    // Prefer SLD for Horn clauses, SMT for general FOL
    if (this.isHorn(formula)) {
      return this.engines.get('sld') ?? this.engines.get('smt')!;
    }
    return this.engines.get('smt') ?? this.engines.get('sld')!;
  }

  /** Check if formula is Horn (all clauses have at most one positive literal). */
  private isHorn(formula: Formula): boolean {
    // Simplified check - would need CNF conversion
    return false;
  }

  /** Get all registered engines. */
  getAll(): ReasoningEngine[] {
    return Array.from(this.engines.values());
  }
}

/** SLD Engine wrapper. */
export class SLDEngine implements ReasoningEngine {
  readonly type: EngineType = 'sld';
  readonly name = 'SLD Resolver';

  private resolver: SLDResolver;
  private stats: EngineStatistics = { queries: 0, totalTimeMs: 0, satCalls: 0, unsatCalls: 0, unknownCalls: 0 };
  private readonly clock: Clock;

  constructor(
    config?: Partial<SLDConfig>,
    options?: { clock?: Clock }
  ) {
    this.resolver = createSLDResolver([], config);
    this.clock = options?.clock ?? createDefaultClock();
  }

  /** Set clauses. */
  setClauses(clauses: import('./ast.js').Clause[]): void {
    // Recreate resolver with new clauses
    this.resolver = createSLDResolver(clauses);
  }

  async checkSat(formula: Formula): Promise<QueryResult> {
    const start = this.clock.now();
    this.stats.queries++;

    // Convert formula to query (conjunction of atoms)
    // For SLD, we query the negation of the formula
    const result = this.resolver.resolve([]);

    const timeMs = this.clock.now() - start;
    this.stats.totalTimeMs += timeMs;

    if (result.success) {
      this.stats.satCalls++;
      return { satisfiable: true, statistics: { timeMs, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 } };
    } else {
      this.stats.unsatCalls++;
      return { satisfiable: false, statistics: { timeMs, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 } };
    }
  }

  async findModels(formula: Formula, maxModels = 10): Promise<Model[]> {
    // SLD doesn't directly find models, use ModelFinder instead
    const finder = createModelFinder({ maxModels });
    const result = finder.findModels(formula);
    return [...result.models];
  }

  async prove(theorem: Formula): Promise<ProofCertificate | null> {
    // SLD proof generation would require more infrastructure
    return null;
  }

  async extractMUS(formula: Formula): Promise<{ clauses: readonly import('./ast.js').Clause[] } | null> {
    const extractor = createMUSExtractor();
    // Convert to CNF first
    const { toCNF } = await import('./cnf.js');
    const cnf = toCNF(formula);
    return extractor.findOneMUS(cnf.clauses);
  }

  getStatistics(): EngineStatistics {
    return { ...this.stats };
  }
}

/** SMT Engine wrapper (placeholder for external SMT solver). */
export class SMTEngine implements ReasoningEngine {
  readonly type: EngineType = 'smt';
  readonly name = 'SMT Solver';

  private stats: EngineStatistics = { queries: 0, totalTimeMs: 0, satCalls: 0, unsatCalls: 0, unknownCalls: 0 };
  private config: EngineConfig;
  private readonly clock: Clock;

  constructor(
    config: EngineConfig = { type: 'smt' },
    options?: { clock?: Clock }
  ) {
    this.config = config;
    this.clock = options?.clock ?? createDefaultClock();
  }

  async checkSat(formula: Formula): Promise<QueryResult> {
    const start = this.clock.now();
    this.stats.queries++;

    // In a real implementation, this would call Z3, CVC5, etc.
    // For now, use ModelFinder as fallback
    const finder = createModelFinder({ maxModels: 1, timeoutMs: this.config.timeoutMs ?? 30000 });
    const result = finder.findModels(formula);

    const timeMs = this.clock.now() - start;
    this.stats.totalTimeMs += timeMs;

    if (result.satisfiable) {
      this.stats.satCalls++;
      return { satisfiable: true, models: result.models, statistics: { timeMs, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 } };
    } else {
      this.stats.unsatCalls++;
      return { satisfiable: false, statistics: { timeMs, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 } };
    }
  }

  async findModels(formula: Formula, maxModels = 10): Promise<Model[]> {
    const finder = createModelFinder({ maxModels, timeoutMs: this.config.timeoutMs ?? 30000 });
    const result = finder.findModels(formula);
    return [...result.models];
  }

  async prove(theorem: Formula): Promise<ProofCertificate | null> {
    // SMT proof generation would require solver-specific proof output
    return null;
  }

  async extractMUS(formula: Formula): Promise<{ clauses: readonly import('./ast.js').Clause[] } | null> {
    const extractor = createMUSExtractor();
    const { toCNF } = await import('./cnf.js');
    const cnf = toCNF(formula);
    return extractor.findOneMUS(cnf.clauses);
  }

  getStatistics(): EngineStatistics {
    return { ...this.stats };
  }
}

/** ASP Engine wrapper (placeholder for Clingo). */
export class ASPEngine implements ReasoningEngine {
  readonly type: EngineType = 'asp';
  readonly name = 'ASP Solver (Clingo)';

  private stats: EngineStatistics = { queries: 0, totalTimeMs: 0, satCalls: 0, unsatCalls: 0, unknownCalls: 0 };
  private readonly clock: Clock;

  constructor(options?: { clock?: Clock }) {
    this.clock = options?.clock ?? createDefaultClock();
  }

  async checkSat(formula: Formula): Promise<QueryResult> {
    const start = this.clock.now();
    this.stats.queries++;

    // Placeholder - would call Clingo
    const finder = createModelFinder({ maxModels: 1 });
    const result = finder.findModels(formula);

    const timeMs = this.clock.now() - start;
    this.stats.totalTimeMs += timeMs;

    if (result.satisfiable) {
      this.stats.satCalls++;
      return { satisfiable: true, models: result.models, statistics: { timeMs, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 } };
    } else {
      this.stats.unsatCalls++;
      return { satisfiable: false, statistics: { timeMs, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 } };
    }
  }

  async findModels(formula: Formula, maxModels = 10): Promise<Model[]> {
    const finder = createModelFinder({ maxModels });
    const result = finder.findModels(formula);
    return [...result.models];
  }

  async prove(theorem: Formula): Promise<ProofCertificate | null> {
    return null;
  }

  async extractMUS(formula: Formula): Promise<{ clauses: readonly import('./ast.js').Clause[] } | null> {
    const extractor = createMUSExtractor();
    const { toCNF } = await import('./cnf.js');
    const cnf = toCNF(formula);
    return extractor.findOneMUS(cnf.clauses);
  }

  getStatistics(): EngineStatistics {
    return { ...this.stats };
  }
}

/** Prolog Engine wrapper (placeholder for Tau Prolog). */
export class PrologEngine implements ReasoningEngine {
  readonly type: EngineType = 'prolog';
  readonly name = 'Prolog (Tau Prolog)';

  private stats: EngineStatistics = { queries: 0, totalTimeMs: 0, satCalls: 0, unsatCalls: 0, unknownCalls: 0 };
  private readonly clock: Clock;

  constructor(options?: { clock?: Clock }) {
    this.clock = options?.clock ?? createDefaultClock();
  }

  async checkSat(formula: Formula): Promise<QueryResult> {
    const start = this.clock.now();
    this.stats.queries++;

    // Placeholder - would call Tau Prolog
    const finder = createModelFinder({ maxModels: 1 });
    const result = finder.findModels(formula);

    const timeMs = this.clock.now() - start;
    this.stats.totalTimeMs += timeMs;

    if (result.satisfiable) {
      this.stats.satCalls++;
      return { satisfiable: true, models: result.models, statistics: { timeMs, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 } };
    } else {
      this.stats.unsatCalls++;
      return { satisfiable: false, statistics: { timeMs, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 } };
    }
  }

  async findModels(formula: Formula, maxModels = 10): Promise<Model[]> {
    const finder = createModelFinder({ maxModels });
    const result = finder.findModels(formula);
    return [...result.models];
  }

  async prove(theorem: Formula): Promise<ProofCertificate | null> {
    return null;
  }

  async extractMUS(formula: Formula): Promise<{ clauses: readonly import('./ast.js').Clause[] } | null> {
    const extractor = createMUSExtractor();
    const { toCNF } = await import('./cnf.js');
    const cnf = toCNF(formula);
    return extractor.findOneMUS(cnf.clauses);
  }

  getStatistics(): EngineStatistics {
    return { ...this.stats };
  }
}

/** Default engine factory with all engines registered. */
export function createDefaultEngineFactory(): EngineFactory {
  const factory = new EngineFactory();
  factory.register(new SLDEngine());
  factory.register(new SMTEngine());
  factory.register(new ASPEngine());
  factory.register(new PrologEngine());
  return factory;
}

/** Engine selector based on formula characteristics. */
export function selectEngine(formula: Formula, available: ReasoningEngine[]): ReasoningEngine {
  // Prefer SLD for definite Horn clauses
  // Prefer SMT for general FOL with arithmetic
  // Prefer ASP for non-monotonic reasoning
  // Prefer Prolog for logic programming

  // Simple heuristic
  if (isDefiniteHorn(formula)) {
    return available.find(e => e.type === 'sld') ?? available[0]!;
  }

  return available.find(e => e.type === 'smt') ?? available[0]!;
}

/** Check if formula is definite Horn. */
function isDefiniteHorn(formula: Formula): boolean {
  // Simplified: check if all implications have single positive head
  // Full implementation would require CNF conversion
  return false;
}

/** Cross-engine verification. */
export async function crossEngineVerify(
  formula: Formula,
  engines: ReasoningEngine[]
): Promise<{ consistent: boolean; results: Map<EngineType, QueryResult> }> {
  const results = new Map<EngineType, QueryResult>();

  for (const engine of engines) {
    try {
      const result = await engine.checkSat(formula);
      results.set(engine.type, result);
    } catch (error) {
      results.set(engine.type, {
        satisfiable: false,
        statistics: { timeMs: 0, nodesVisited: 0, clausesGenerated: 0, backtracks: 0 },
      });
    }
  }

  // Check consistency
  const satResults = Array.from(results.values()).filter(r => r.satisfiable);
  const unsatResults = Array.from(results.values()).filter(r => !r.satisfiable);

  const consistent = satResults.length === 0 || unsatResults.length === 0;

  return { consistent, results };
}