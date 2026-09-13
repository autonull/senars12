export interface PolicyRule {
  readonly allowCommands?: readonly string[];
  readonly denyCommands?: readonly string[];
  readonly allowFiles?: readonly string[];
  readonly denyFiles?: readonly string[];
  readonly allowShell?: boolean;
  readonly maxFileSize?: number;
  readonly sandboxDir?: string;
}

const DEFAULT_POLICY: PolicyRule = {
  allowCommands: ['send', 'remember', 'query', 'episodes', 'metta'],
  denyCommands: ['shell'],
  allowFiles: [],
  denyFiles: [],
  allowShell: false,
  maxFileSize: 1024 * 1024,
  sandboxDir: './sandbox',
};

export class PolicyEngine {
  #policy: PolicyRule;

  constructor(policy: Partial<PolicyRule> = {}) {
    this.#policy = { ...DEFAULT_POLICY, ...policy };
  }

  checkCommand(command: string): { allowed: boolean; reason?: string } {
    if (this.#policy.denyCommands?.includes(command)) {
      return { allowed: false, reason: `Command "${command}" is denied by policy` };
    }
    if (this.#policy.allowCommands && this.#policy.allowCommands.length > 0) {
      if (!this.#policy.allowCommands.includes(command)) {
        return { allowed: false, reason: `Command "${command}" is not in allowlist` };
      }
    }
    return { allowed: true };
  }

  checkFileAccess(filepath: string): { allowed: boolean; reason?: string } {
    const sandbox = this.#policy.sandboxDir;
    if (sandbox && !filepath.startsWith(sandbox)) {
      return { allowed: false, reason: `File "${filepath}" is outside sandbox "${sandbox}"` };
    }
    if (this.#policy.denyFiles?.some((d) => filepath.includes(d))) {
      return { allowed: false, reason: `File "${filepath}" matches deny pattern` };
    }
    return { allowed: true };
  }

  checkShell(): { allowed: boolean; reason?: string } {
    if (!this.#policy.allowShell) {
      return { allowed: false, reason: 'Shell execution is disabled by policy' };
    }
    return { allowed: true };
  }

  updatePolicy(patch: Partial<PolicyRule>): void {
    this.#policy = { ...this.#policy, ...patch };
  }

  getPolicy(): Readonly<PolicyRule> {
    return this.#policy;
  }
}
