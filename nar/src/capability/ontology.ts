/**
 * CapabilityOntology — declarative inventory of capabilities (tools, rules, metta, skills)
 * Registers into CapabilitySpace for sandboxed execution.
 * Consumers: delegation, curriculum probes (.probes), self-report.
 */

import { CapabilitySpace, type CapabilityDef } from './space.js';
import type { ToolSpec } from '@senars/core/motor/ToolRegistry.js';

export type CapabilityType = 'tool' | 'rule' | 'metta' | 'skill';

export interface CapabilitySchema {
  readonly input: Record<string, { type: string; required?: boolean; description?: string }>;
  readonly output: { type: string; description?: string };
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

    this.entries.set(entry.id, entry);
    const typeSet = this.typeIndex.get(entry.type) ?? new Set();
    typeSet.add(entry.id);
    this.typeIndex.set(entry.type, typeSet);

    // Register with CapabilitySpace for execution
    const capabilityDef: CapabilityDef = {
      name: entry.id,
      description: entry.description,
      risk: entry.risk,
      execute: entry.execute,
    };
    this.space.register(capabilityDef);
  }

  /** Register a tool as a capability. */
  registerTool(tool: ToolSpec, costEstimate = 100, prerequisites: string[] = []): void {
    this.register({
      id: `tool:${tool.name}`,
      type: 'tool',
      name: tool.name,
      description: tool.description,
      schema: {
        input: tool.parameters
          ? Object.fromEntries(
              Object.entries(tool.parameters).map(([k, v]) => [
                k,
                { type: (v as any).type ?? 'string', required: false, description: (v as any).description },
              ])
            )
          : {},
        output: { type: 'any', description: 'Tool execution result' },
      },
      costEstimate,
      prerequisites,
      risk: 'low',
      version: '1.0.0',
      execute: tool.execute as (args: Record<string, unknown>) => unknown | Promise<unknown>,
    });
  }

  /** Register a MeTTa skill as a capability. */
  registerMettaSkill(id: string, name: string, schema: CapabilitySchema, execute: (args: Record<string, unknown>) => unknown | Promise<unknown>, costEstimate = 500, prerequisites: string[] = []): void {
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
      execute,
    });
  }

  /** Register a reasoning rule as a capability. */
  registerRule(id: string, name: string, schema: CapabilitySchema, execute: (args: Record<string, unknown>) => unknown | Promise<unknown>, costEstimate = 50, prerequisites: string[] = []): void {
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
      execute,
    });
  }

  /** Register a cognitive skill as a capability. */
  registerSkill(id: string, name: string, schema: CapabilitySchema, execute: (args: Record<string, unknown>) => unknown | Promise<unknown>, costEstimate = 200, prerequisites: string[] = []): void {
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
      execute,
    });
  }

  /** Get a capability by ID. */
  get(id: string): CapabilityOntologyEntry | undefined {
    return this.entries.get(id);
  }

  /** Get all capabilities of a specific type. */
  getByType(type: CapabilityType): CapabilityOntologyEntry[] {
    const ids = this.typeIndex.get(type) ?? new Set();
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
  async execute(id: string, args: Record<string, unknown> = {}): Promise<{ success: boolean; result?: unknown; error?: string }> {
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
    return this.getAll().filter((c) => c.risk === 'low' && c.prerequisites.every((p) => this.entries.has(p)));
  }

  /** Get curriculum probes — capabilities with corrections/low grades. */
  getProbes(): CapabilityOntologyEntry[] {
    // In practice, this would filter by retrospective grades
    return this.getAll().filter((c) => c.type === 'skill' || c.type === 'rule');
  }
}

export function createCapabilityOntology(options?: CapabilityOntologyOptions): CapabilityOntology {
  return new CapabilityOntology(options);
}