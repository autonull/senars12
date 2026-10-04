/**
 * CapabilityOntology — declarative inventory of capabilities (tools, rules, metta, skills)
 * Registers into CapabilitySpace for sandboxed execution.
 * Consumers: delegation, curriculum probes (.probes), self-report.
 */

import type { ToolSpec } from '@senars/core/motor';
import { addToSet, mapValues, shortSha256Hex } from '@senars/util';
import type { Tool as NarTool, ToolSchema as NarSchema } from '../tools/types.js';
import { type CapabilityDef, CapabilitySpace } from './space.js';

export type CapabilityType = 'tool' | 'rule' | 'metta' | 'skill';

export interface CapabilitySchema {
  readonly input: Record<string, { type: string; required?: boolean; description?: string }>;
  readonly output: { type: string; description?: string };
}

export interface Provenance {
  readonly source: 'builtin' | 'learned' | 'delegated' | 'scaffolded';
  readonly digest: string; // SHA256 of capability definition
  readonly proofRef?: string; // reference to derivation/adaptation record
  /** NEW: chain of adaptations that produced this capability */
  readonly derivationChain?: readonly string[]; // adaptationIds from GovernanceResolver
  /** NEW: parent capability from which this was derived */
  readonly parentId?: string;
}

export interface CapabilityOntologyEntry {
  readonly id: string;
  readonly type: CapabilityType;
  readonly name: string;
  readonly description?: string;
  readonly schema: CapabilitySchema;
  readonly costEstimate: number; // estimated CPU cycles / ms
  readonly prerequisites: readonly string[]; // other capability IDs that must be available
  readonly risk: 'low' | 'medium' | 'high';
  readonly version: string;
  readonly provenance: Provenance;
  readonly execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface CapabilityOntologyOptions {
  allowedMutations?: string[];
  sandbox?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export class CapabilityOntology {
  private readonly space: CapabilitySpace;
  private readonly entries = new Map<string, CapabilityOntologyEntry>();
  private readonly typeIndex = new Map<CapabilityType, Set<string>>();

  constructor(options: CapabilityOntologyOptions = {}) {
    this.space = new CapabilitySpace({
      allowedMutations: options.allowedMutations,
      sandbox: options.sandbox,
    });
  }

  /** Register a capability in the ontology. */
  register(entry: CapabilityOntologyEntry): void {
    if (this.entries.has(entry.id)) {
      throw new Error(`Capability '${entry.id}' already registered`);
    }

    // Check prerequisites exist
    for (const prereq of entry.prerequisites) {
      if (!this.entries.has(prereq)) {
        throw new Error(`Prerequisite '${prereq}' not found for capability '${entry.id}'`);
      }
    }

    // Validate provenance chain integrity (no orphan adaptations)
    if (entry.provenance.derivationChain) {
      for (const adaptationId of entry.provenance.derivationChain) {
        // In a full implementation, this would check against a governance ledger
        // For now, we accept any non-empty string as a valid adaptation reference
        if (!adaptationId || typeof adaptationId !== 'string') {
          throw new Error(`Invalid adaptationId in derivationChain for capability '${entry.id}'`);
        }
      }
    }

    // Validate parentId if present
    if (entry.provenance.parentId) {
      if (!this.entries.has(entry.provenance.parentId)) {
        throw new Error(
          `Parent capability '${entry.provenance.parentId}' not found for capability '${entry.id}'`
        );
      }
    }

    this.entries.set(entry.id, entry);
    addToSet(this.typeIndex, entry.type, entry.id);

    // Register with CapabilitySpace for execution
    const capabilityDef: CapabilityDef = {
      name: entry.id,
      description: entry.description,
      risk: entry.risk,
      execute: entry.execute,
    };
    this.space.register(capabilityDef);
  }

  /** Register a tool as a capability (accepts NAR's Tool with Schema). */
  registerTool(
    tool: NarTool,
    costEstimate = 100,
    prerequisites: string[] = [],
    provenanceOverrides?: Partial<Provenance>
  ): void {
    // Convert NAR's Schema to the flat format expected by CapabilitySchema.input
    const required = new Set(tool.parameters?.required ?? []);
    const inputSchema = tool.parameters
      ? mapValues(tool.parameters.properties, (v, k) => ({
          type: v.type,
          required: required.has(k),
          description: v.description,
        }))
      : {};
    this.register({
      id: `tool:${tool.name}`,
      type: 'tool',
      name: tool.name,
      description: tool.description,
      schema: {
        input: inputSchema,
        output: { type: 'any', description: 'Tool execution result' },
      },
      costEstimate,
      prerequisites,
      risk: 'low',
      version: '1.0.0',
      provenance: {
        source: 'builtin',
        digest: this.computeDigest(tool.name, 'tool'),
        proofRef: undefined,
        derivationChain: provenanceOverrides?.derivationChain,
        parentId: provenanceOverrides?.parentId,
      },
      execute: tool.execute as (args: Record<string, unknown>) => unknown | Promise<unknown>,
    });
  }

  /** Register a MeTTa skill as a capability. */
  registerMettaSkill(
    id: string,
    name: string,
    schema: CapabilitySchema,
    execute: (args: Record<string, unknown>) => unknown | Promise<unknown>,
    costEstimate = 500,
    prerequisites: string[] = [],
    provenanceOverrides?: Partial<Provenance>
  ): void {
    this.register({
      id: `metta:${id}`,
      type: 'metta',
      name,
      description: `MeTTa skill: ${name}`,
      schema,
      costEstimate,
      prerequisites,
      risk: 'medium',
      version: '1.0.0',
      provenance: {
        source: 'builtin',
        digest: this.computeDigest(id, 'metta'),
        proofRef: undefined,
        derivationChain: provenanceOverrides?.derivationChain,
        parentId: provenanceOverrides?.parentId,
      },
      execute,
    });
  }

  /** Register a reasoning rule as a capability. */
  registerRule(
    id: string,
    name: string,
    schema: CapabilitySchema,
    execute: (args: Record<string, unknown>) => unknown | Promise<unknown>,
    costEstimate = 50,
    prerequisites: string[] = [],
    provenanceOverrides?: Partial<Provenance>
  ): void {
    this.register({
      id: `rule:${id}`,
      type: 'rule',
      name,
      description: `Reasoning rule: ${name}`,
      schema,
      costEstimate,
      prerequisites,
      risk: 'low',
      version: '1.0.0',
      provenance: {
        source: 'builtin',
        digest: this.computeDigest(id, 'rule'),
        proofRef: undefined,
        derivationChain: provenanceOverrides?.derivationChain,
        parentId: provenanceOverrides?.parentId,
      },
      execute,
    });
  }

  /** Register a cognitive skill as a capability. */
  registerSkill(
    id: string,
    name: string,
    schema: CapabilitySchema,
    execute: (args: Record<string, unknown>) => unknown | Promise<unknown>,
    costEstimate = 200,
    prerequisites: string[] = [],
    provenanceOverrides?: Partial<Provenance>
  ): void {
    this.register({
      id: `skill:${id}`,
      type: 'skill',
      name,
      description: `Cognitive skill: ${name}`,
      schema,
      costEstimate,
      prerequisites,
      risk: 'medium',
      version: '1.0.0',
      provenance: {
        source: 'builtin',
        digest: this.computeDigest(id, 'skill'),
        proofRef: undefined,
        derivationChain: provenanceOverrides?.derivationChain,
        parentId: provenanceOverrides?.parentId,
      },
      execute,
    });
  }

  /** Register a learned capability with full provenance chain. */
  registerLearned(
    id: string,
    type: CapabilityType,
    name: string,
    schema: CapabilitySchema,
    execute: (args: Record<string, unknown>) => unknown | Promise<unknown>,
    costEstimate: number,
    prerequisites: string[],
    risk: 'low' | 'medium' | 'high',
    derivationChain: readonly string[],
    parentId: string | undefined,
    proofRef: string | undefined
  ): void {
    this.register({
      id,
      type,
      name,
      schema,
      costEstimate,
      prerequisites,
      risk,
      version: '1.0.0',
      provenance: {
        source: 'learned',
        digest: this.computeDigest(id, type),
        proofRef,
        derivationChain,
        parentId,
      },
      execute,
    });
  }

  /** Get a capability by ID. */
  get(id: string): CapabilityOntologyEntry | undefined {
    return this.entries.get(id);
  }

  /** Get all capabilities of a specific type. */
  getByType(type: CapabilityType): CapabilityOntologyEntry[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    return [...ids].map((id) => this.entries.get(id)!).filter(Boolean);
  }

  /** Get all registered capabilities. */
  getAll(): CapabilityOntologyEntry[] {
    return [...this.entries.values()];
  }

  /** Check if a capability is registered. */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Execute a capability by ID. */
  async execute(
    id: string,
    args: Record<string, unknown> = {}
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const entry = this.entries.get(id);
    if (!entry) {
      return { success: false, error: `Capability '${id}' not found` };
    }
    return this.space.execute(id, args);
  }

  /** Get capability names for listing. */
  names(): string[] {
    return [...this.entries.keys()];
  }

  /** Get execution history. */
  history() {
    return this.space.records();
  }

  /** Get the underlying CapabilitySpace for advanced operations. */
  getSpace(): CapabilitySpace {
    return this.space;
  }

  /** Get capabilities suitable for delegation (low risk, no unmet prerequisites). */
  getDelegatable(): CapabilityOntologyEntry[] {
    return this.getAll().filter(
      (c) => c.risk === 'low' && c.prerequisites.every((p) => this.entries.has(p))
    );
  }

  /** Get curriculum probes — capabilities with corrections/low grades. */
  getProbes(): CapabilityOntologyEntry[] {
    // In practice, this would filter by retrospective grades
    return this.getAll().filter((c) => c.type === 'skill' || c.type === 'rule');
  }

  /** Compute a SHA256 digest for provenance. */
  private computeDigest(name: string, type: string): string {
    return shortSha256Hex(`${type}:${name}:${Date.now()}`);
  }
}

export function createCapabilityOntology(options?: CapabilityOntologyOptions): CapabilityOntology {
  return new CapabilityOntology(options);
}
