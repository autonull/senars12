export type CapabilityRisk = 'low' | 'medium' | 'high';

export interface CapabilityDef {
  name: string;
  description?: string;
  risk?: CapabilityRisk;
  execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface CapabilityPolicy {
  checkCommand(command: string): { allowed: boolean; reason?: string };
}

export interface CapabilityApproval {
  requestApproval(request: { action: string; payload: string; risk: CapabilityRisk }): Promise<{ approved: boolean; feedback?: string }>;
}

export interface CapabilityResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface AstDiff {
  kind: string;
  payload: unknown;
}

export interface CapabilityRecord {
  name: string;
  success: boolean;
  at: number;
}

export interface CapabilitySpaceOptions {
  policy?: CapabilityPolicy;
  approval?: CapabilityApproval;
  allowedMutations?: string[];
  sandbox?: <T>(fn: () => Promise<T>) => Promise<T>;
}

const DEFAULT_MUTATIONS = [
  'add-rule',
  'tune-knob',
  'register-tool',
  'apply-fix',
  'modify-code',
  'add-test',
  'remove-test',
  'modify-config',
  'promote-schema',
  'scaffold-capability',
];

export class CapabilitySpace {
  private readonly capabilities = new Map<string, CapabilityDef>();
  private readonly history: CapabilityRecord[] = [];
  private readonly policy?: CapabilityPolicy;
  private readonly approval?: CapabilityApproval;
  private readonly allowedMutations: Set<string>;
  private readonly sandbox: <T>(fn: () => Promise<T>) => Promise<T>;

  constructor(opts: CapabilitySpaceOptions = {}) {
    this.policy = opts.policy;
    this.approval = opts.approval;
    this.allowedMutations = new Set(opts.allowedMutations ?? DEFAULT_MUTATIONS);
    this.sandbox = opts.sandbox ?? ((fn) => fn());
  }

  register(def: CapabilityDef): void {
    this.capabilities.set(def.name, def);
  }

  importFrom(registry: { list(): Array<{ name: string; description?: string; execute: CapabilityDef['execute'] }> }): void {
    for (const tool of registry.list()) this.register({ name: tool.name, description: tool.description, execute: tool.execute });
  }

  names(): string[] {
    return [...this.capabilities.keys()];
  }

  records(): CapabilityRecord[] {
    return [...this.history];
  }

  validateDiff(diff: AstDiff): { allowed: boolean; reason?: string } {
    return this.allowedMutations.has(diff.kind)
      ? { allowed: true }
      : { allowed: false, reason: `mutation kind "${diff.kind}" outside cognitive grammar` };
  }

  async execute(name: string, args: Record<string, unknown> = {}): Promise<CapabilityResult> {
    const capability = this.capabilities.get(name);
    if (!capability) return this.record(name, { success: false, error: `capability '${name}' not found` });
    const verdict = this.policy?.checkCommand(name);
    if (verdict && !verdict.allowed) return this.record(name, { success: false, error: verdict.reason ?? 'denied by policy' });
    if (capability.risk && capability.risk !== 'low' && this.approval) {
      const decision = await this.approval.requestApproval({ action: name, payload: JSON.stringify(args), risk: capability.risk });
      if (!decision.approved) return this.record(name, { success: false, error: decision.feedback ?? 'rejected by approval' });
    }
    try {
      const result = await this.sandbox(() => Promise.resolve(capability.execute(args)));
      return this.record(name, { success: true, result });
    } catch (error) {
      return this.record(name, { success: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private record(name: string, result: CapabilityResult): CapabilityResult {
    this.history.push({ name, success: result.success, at: Date.now() });
    return result;
  }
}
