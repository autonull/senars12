import path from 'node:path';
import type { Verdict } from './schemas/gate-io.js';
import { containsPath } from '@senars/util';

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
  allowCommands: ['send', 'remember', 'query', 'episodes'],
  denyCommands: ['shell'],
  allowFiles: [],
  denyFiles: [],
  allowShell: false,
  maxFileSize: 1024 * 1024,
  sandboxDir: './sandbox',
};

/**
 * What a policy check answers. One record for all three checks, and the same
 * `Verdict` the kernel gates, the epistemic firewall and the judgment resource
 * gate answer in — each keeping the field names its own callers read.
 */
export type PolicyDecision = Verdict<'allowed'>;

export class PolicyEngine {
  #policy: PolicyRule;

  constructor(policy: Partial<PolicyRule> = {}) {
    this.#policy = { ...DEFAULT_POLICY, ...policy };
  }

  checkCommand(command: string): PolicyDecision {
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

  checkFileAccess(filepath: string): PolicyDecision {
    const sandbox = this.#policy.sandboxDir;
    // Both sides resolved, then handed to the one containment predicate the motor
    // workspace and the fs tool use. This was a raw `startsWith`, which is what
    // made `./sandbox-evil` and `./sandbox/../../etc/passwd` both read as inside
    // `./sandbox` — and resolving first is what closes the `..` escape, since
    // `containsPath` answers about literal prefixes, not about where a path lands.
    if (sandbox && !containsPath(path.resolve(sandbox), path.resolve(filepath))) {
      return { allowed: false, reason: `File "${filepath}" is outside sandbox "${sandbox}"` };
    }
    if (this.#policy.denyFiles?.some((d) => filepath.includes(d))) {
      return { allowed: false, reason: `File "${filepath}" matches deny pattern` };
    }
    return { allowed: true };
  }

  checkShell(): PolicyDecision {
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
