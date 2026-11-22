/**
 * Portals — the unified gateway for all external calls and truth-valued logics.
 *
 * Portals combine oracles (external/nondeterministic calls) and logics
 * (truth-valued reasoning systems) behind a single frozen interface.
 * All external calls in src/ must go through a Portal.
 */

import type { OracleOperation, Oracle, OracleInput, OracleOutput, OracleMeta, OracleConfig, OracleStats, OracleTelemetrySink } from '../oracles/oracle';
import type { Logic, Codec, RuleAST, Premise, StepResult } from '../logics/port';
import type { UUID, TimestampMs } from '../generated/schemas';
import type { BudgetSlice, BudgetResource } from '../budget/budget';
import { createOracleRegistry, type OracleRegistry } from '../oracles/oracle';
import { createLogicRegistry, type LogicRegistry } from '../logics/port';
import { FUZZY_LOGIC } from '../logics/fuzzy';
import { Term } from '../kernel/terms/intern';
import { TruthValue } from '../kernel/types';
import { Stamp } from '../kernel/stamp';

/** Portal types. */
export const PORTAL_TYPES = ['oracle', 'logic'] as const;
export type PortalType = (typeof PORTAL_TYPES)[number];

/** Portal base interface. */
export interface Portal {
  /** Unique portal ID. */
  readonly id: string;
  /** Portal type. */
  readonly type: PortalType;
  /** Version. */
  readonly version: string;
}

/** Oracle portal — combines Portal metadata with Oracle functionality. */
export interface OraclePortal {
  /** Unique portal ID. */
  readonly id: string;
  /** Portal type. */
  readonly type: 'oracle';
  /** Portal version. */
  readonly version: string;
  /** The operation this oracle handles. */
  readonly operation: OracleOperation;
  /** The provider this oracle uses. */
  readonly provider: string;
  /** Model/engine version. */
  readonly oracleVersion?: string;
  /** Budget resource to charge for this oracle's calls. */
  readonly budgetResource?: BudgetResource;

  /** Zod schema for input validation. */
  readonly inputSchema: unknown; // ZodType<OracleInput>
  /** Zod schema for output validation. */
  readonly outputSchema: unknown; // ZodType<OracleOutput>
  /** Zod schema for certificate (optional). */
  readonly certificateSchema?: unknown; // ZodType<any>

  /** Execute the oracle call. */
  call(input: OracleInput, budgetSlice?: BudgetSlice): Promise<OracleOutput>;
  /** Check if the oracle is available. */
  isAvailable(): Promise<boolean>;
  /** Get oracle statistics. */
  getStats(): OracleStats;
}

/** Logic portal — extends Logic with portal metadata. */
export interface LogicPortal extends Portal {
  readonly type: 'logic';
  /** The logic implementation. */
  readonly logic: Logic<any>;
  /** Zod schema for term serialization. */
  readonly termSchema: unknown; // ZodType<any>
  /** Zod schema for truth value. */
  readonly truthSchema: unknown; // ZodType<TruthValue>
}

/** Union of all portal types. */
export type AnyPortal = OraclePortal | LogicPortal;

/** Portal registry — manages all portals (oracles + logics). */
export class PortalRegistry {
  private portals = new Map<string, AnyPortal>();
  private oracles: OracleRegistry;
  private logics: LogicRegistry;

  constructor() {
    this.oracles = createOracleRegistry();
    this.logics = createLogicRegistry();
  }

  /** Register an oracle portal. */
  registerOracle(portal: OraclePortal): void {
    if (this.portals.has(portal.id)) {
      throw new Error(`Portal ${portal.id} already registered`);
    }
    this.portals.set(portal.id, portal);
    this.oracles.register(portal as any);
  }

  /** Register a logic portal. */
  registerLogic(portal: LogicPortal): void {
    if (this.portals.has(portal.id)) {
      throw new Error(`Portal ${portal.id} already registered`);
    }
    this.portals.set(portal.id, portal);
    this.logics.register(portal.logic);
  }

  /** Get a portal by ID. */
  get(id: string): AnyPortal | undefined {
    return this.portals.get(id);
  }

  /** Get an oracle portal by operation. */
  getOracle(operation: OracleOperation): OraclePortal | undefined {
    const oracle = this.oracles.get(operation);
    if (!oracle) return undefined;
    for (const portal of this.portals.values()) {
      if (portal.type === 'oracle' && portal.operation === operation) {
        return portal;
      }
    }
    return undefined;
  }

  /** Get a logic portal by ID. */
  getLogic(id: string): LogicPortal | undefined {
    const logic = this.logics.get(id);
    if (!logic) return undefined;
    for (const portal of this.portals.values()) {
      if (portal.type === 'logic' && portal.id === id) {
        return portal;
      }
    }
    return undefined;
  }

  /** Get all registered portals. */
  getAll(): AnyPortal[] {
    return Array.from(this.portals.values());
  }

  /** Get all oracle portals. */
  getAllOraclePortals(): OraclePortal[] {
    return this.getAll().filter(p => p.type === 'oracle') as OraclePortal[];
  }

  /** Get all logic portals. */
  getAllLogicPortals(): LogicPortal[] {
    return this.getAll().filter(p => p.type === 'logic') as LogicPortal[];
  }

  /** Check if a portal is registered. */
  has(id: string): boolean {
    return this.portals.has(id);
  }

  /** Get the underlying oracle registry. */
  getOracleRegistry(): OracleRegistry {
    return this.oracles;
  }

  /** Get the underlying logic registry. */
  getLogicRegistry(): LogicRegistry {
    return this.logics;
  }

  /** Call an oracle through the registry. */
  async callOracle<TInput extends OracleInput, TOutput>(
    operation: OracleOperation,
    input: TInput,
    pinning = false,
    budgetSlice?: BudgetSlice
  ): Promise<OracleOutput<TOutput>> {
    return this.oracles.call(operation, input, pinning, budgetSlice);
  }
}

/** Create an isolated portal registry. */
export function createPortalRegistry(): PortalRegistry {
  return new PortalRegistry();
}

/** Standard oracle definitions for the 10 core oracles. */
export const STANDARD_ORACLE_DEFINITIONS: ReadonlyArray<{
  id: string;
  operation: OracleOperation;
  provider: string;
  version: string;
  description: string;
}> = [
  // LM oracles (3)
  { id: 'lm.generateText', operation: 'lm.generateText', provider: 'openai', version: '1.0.0', description: 'Generate text from LM' },
  { id: 'lm.generateObject', operation: 'lm.generateObject', provider: 'openai', version: '1.0.0', description: 'Generate structured object from LM' },
  { id: 'lm.stream', operation: 'lm.stream', provider: 'openai', version: '1.0.0', description: 'Stream text from LM' },

  // Formalization oracles (2)
  { id: 'formalization.nlToFormal', operation: 'formalization.nlToFormal', provider: 'internal', version: '1.0.0', description: 'Natural language to formal terms' },
  { id: 'formalization.formalToNl', operation: 'formalization.formalToNl', provider: 'internal', version: '1.0.0', description: 'Formal terms to natural language' },

  // Engine oracles (5)
  { id: 'engine.z3', operation: 'engine.z3', provider: 'z3-wasm', version: '1.0.0', description: 'Z3 SMT solver (WASM)' },
  { id: 'engine.clingo', operation: 'engine.clingo', provider: 'clingo-wasm', version: '1.0.0', description: 'Clingo ASP solver (WASM)' },
  { id: 'engine.minisat', operation: 'engine.minisat', provider: 'minisat-wasm', version: '1.0.0', description: 'MiniSat SAT solver (WASM)' },
  { id: 'engine.tau-prolog', operation: 'engine.tau-prolog', provider: 'tau-prolog', version: '1.0.0', description: 'Tau Prolog engine' },
  { id: 'engine.metta', operation: 'engine.metta', provider: 'metta', version: '1.0.0', description: 'MeTTa engine' },
] as const;

/** Standard logic definitions for the 3 core logics. */
export const STANDARD_LOGIC_DEFINITIONS: ReadonlyArray<{
  id: string;
  name: string;
  version: string;
  description: string;
}> = [
  { id: 'nal', name: 'NAL', version: '1.0.0', description: 'Non-Axiomatic Logic with temporal extension' },
  { id: 'axiomatic', name: 'Axiomatic', version: '1.0.0', description: 'Axiomatic logic (SLD resolution + model checking)' },
  { id: 'fuzzy', name: 'Fuzzy', version: '1.0.0', description: 'Fuzzy logic with membership degrees' },
] as const;

/** Create a fully configured portal registry with all 13 standard portals. */
export async function createStandardPortalRegistry(
  lmService?: { hasModel(): boolean; getModel(task: string): unknown; provider?: string; model?: string } | null,
  pinStore?: any
): Promise<PortalRegistry> {
  const registry = new PortalRegistry();

  // Register oracle portals
  const { createStandardOracleRegistry } = await import('../oracles/oracle');
  const oracleRegistry = createStandardOracleRegistry(lmService, pinStore);

  // Wrap each oracle as a portal
  for (const oracle of oracleRegistry.getAll()) {
    const portal: OraclePortal = {
      id: oracle.operation,
      type: 'oracle',
      version: oracle.version ?? '1.0.0',
      operation: oracle.operation,
      provider: oracle.provider,
      budgetResource: oracle.budgetResource,
      inputSchema: null, // TODO: add Zod schemas
      outputSchema: null, // TODO: add Zod schemas
      call: oracle.call.bind(oracle),
      isAvailable: oracle.isAvailable.bind(oracle),
      getStats: oracle.getStats.bind(oracle),
    };
    registry.registerOracle(portal);
  }

  // Register engine oracles
  const { createEngineOracleRegistry } = await import('../oracles/oracle');
  const engineRegistry = await createEngineOracleRegistry({ pinStore });

  for (const oracle of engineRegistry.getAll()) {
    const portal: OraclePortal = {
      id: oracle.operation,
      type: 'oracle',
      version: oracle.version ?? '1.0.0',
      operation: oracle.operation,
      provider: oracle.provider,
      budgetResource: oracle.budgetResource,
      inputSchema: null,
      outputSchema: null,
      call: oracle.call.bind(oracle),
      isAvailable: oracle.isAvailable.bind(oracle),
      getStats: oracle.getStats.bind(oracle),
    };
    registry.registerOracle(portal);
  }

  // Register logic portals
  // NAL logic
  const { NAL_LOGIC } = await import('../logics/nal/logic');
  registry.registerLogic({
    id: 'nal',
    type: 'logic',
    version: '1.0.0',
    logic: NAL_LOGIC,
    termSchema: null,
    truthSchema: null,
  });

  // Axiomatic logic
  const { AXIOMATIC_LOGIC } = await import('../logics/axiomatic/logic');
  registry.registerLogic({
    id: 'axiomatic',
    type: 'logic',
    version: '1.0.0',
    logic: AXIOMATIC_LOGIC,
    termSchema: null,
    truthSchema: null,
  });

  // Fuzzy logic (already has FUZZY_LOGIC)
  registry.registerLogic({
    id: 'fuzzy',
    type: 'logic',
    version: '1.0.0',
    logic: FUZZY_LOGIC,
    termSchema: null,
    truthSchema: null,
  });

  return registry;
}

/** Global portal registry instance (convenience; prefer {@link createPortalRegistry}). */
export const portalRegistry = new PortalRegistry();