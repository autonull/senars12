/**
 * Admission Machinery — self-modification tooling ported as Rung 5 admission machinery.
 *
 * External runner + human merge only. The agent proposes patches via shadow worktree;
 * an external runner validates; human approves; then merge.
 */

import type { Artifact, ArtifactKind, ArtifactStatus, AdmissionEvent } from './repertoire.js';
import type { Clock, RNG, TimestampMs } from '../kernel/env.js';
import { createDefaultClock, createDefaultRNG } from '../kernel/env.js';
import { ShadowWorktreeManager, type TestRunResult } from '../tools/adapters/shadow-worktree.js';
import { runCodemod, type CodemodResult } from '../tools/adapters/codemod.js';
import { runProcess } from '../tools/adapters/proc.js';

/** Admission proposal. */
export interface AdmissionProposal {
  /** Proposal ID. */
  id: string;
  /** Proposal kind. */
  kind: 'code' | 'rule' | 'skill' | 'faculty' | 'config' | 'tool';
  /** Title. */
  title: string;
  /** Description. */
  description: string;
  /** Target artifact (if modifying existing). */
  targetArtifactId?: string;
  /** Shadow worktree ID. */
  worktreeId: string;
  /** Diff. */
  diff: string;
  /** Test results. */
  testResult: TestRunResult;
  /** Status. */
  status: 'pending' | 'approved' | 'rejected' | 'merged' | 'rolled-back';
  /** Created at. */
  createdAt: TimestampMs;
  /** Approved at. */
  approvedAt?: TimestampMs;
  /** Approved by. */
  approvedBy?: string;
  /** Merged at. */
  mergedAt?: TimestampMs;
  /** Rollback reason. */
  rollbackReason?: string;
  /** Metadata. */
  metadata: Record<string, unknown>;
}

/** External runner interface. */
export interface ExternalRunner {
  /** Validate a proposal. */
  validate(proposal: AdmissionProposal): Promise<{ passed: boolean; reason: string; evidence: Record<string, unknown> }>;
  /** Get validation history. */
  getHistory(proposalId: string): Promise<{ passed: boolean; reason: string; timestamp: TimestampMs }[]>;
}

/** Human approval interface. */
export interface HumanApproval {
  /** Request approval. */
  request(proposal: AdmissionProposal): Promise<{ approved: boolean; feedback?: string }>;
  /** Get approval status. */
  getStatus(proposalId: string): Promise<{ approved: boolean; feedback?: string; timestamp: TimestampMs } | null>;
}

/** Admission machinery config. */
export interface AdmissionMachineryConfig {
  /** Workspace root. */
  workspaceRoot: string;
  /** External runner. */
  externalRunner: ExternalRunner;
  /** Human approval. */
  humanApproval: HumanApproval;
  /** Auto-merge after approval. */
  autoMerge: boolean;
  /** Max concurrent proposals. */
  maxConcurrent: number;
  /** Proposal TTL (ms). */
  proposalTtl: number;
}

/** Admission machinery. */
export class AdmissionMachinery {
  private config: AdmissionMachineryConfig;
  private proposals: Map<string, AdmissionProposal> = new Map();
  private shadowManager: ShadowWorktreeManager;
  private clock: Clock;
  private rng: RNG;

  constructor(config: AdmissionMachineryConfig, clock?: Clock, rng?: RNG) {
    this.config = config;
    this.shadowManager = new ShadowWorktreeManager(config.workspaceRoot);
    this.clock = clock ?? createDefaultClock();
    this.rng = rng ?? createDefaultRNG();
  }

  /** Get shadow manager. */
  getShadowManager(): ShadowWorktreeManager {
    return this.shadowManager;
  }

  /** Create a code proposal. */
  async createCodeProposal(
    title: string,
    description: string,
    changes: Array<{ file: string; contents: string }>,
    metadata: Record<string, unknown> = {}
  ): Promise<AdmissionProposal> {
    const proposalId = `prop-${this.clock.now()}-${this.rng.next().toString(36).slice(2, 8)}`;
    const worktreeId = `wt-${proposalId}`;

    // Create shadow worktree
    const worktreePath = await this.shadowManager.createWorktree(worktreeId);

    // Apply changes
    for (const change of changes) {
      const { resolve } = await import('node:path');
      const { writeFile } = await import('node:fs/promises');
      const { ensureParentDir } = await import('@senars/util/fs');
      const target = resolve(worktreePath, change.file);
      await ensureParentDir(target);
      await writeFile(target, change.contents, 'utf-8');
    }

    // Run tests
    const testResult = await this.shadowManager.runTestsInWorktree(worktreePath);

    // Get diff
    const diff = await this.shadowManager.getDiff(worktreePath);

    const proposal: AdmissionProposal = {
      id: proposalId,
      kind: 'code',
      title,
      description,
      worktreeId,
      diff,
      testResult,
      status: 'pending',
      createdAt: this.clock.now(),
      metadata,
    };

    this.proposals.set(proposalId, proposal);
    return proposal;
  }

  /** Create a codemod proposal. */
  async createCodemodProposal(
    title: string,
    description: string,
    pattern: string,
    replacement: string,
    scope: string[] = [],
    lang = 'typescript',
    metadata: Record<string, unknown> = {}
  ): Promise<AdmissionProposal> {
    const proposalId = `prop-${this.clock.now()}-${this.rng.next().toString(36).slice(2, 8)}`;
    const worktreeId = `wt-${proposalId}`;

    // Create shadow worktree
    const worktreePath = await this.shadowManager.createWorktree(worktreeId);

    // Apply codemod
    const codemodResult = await runCodemod(worktreePath, { pattern, replacement, scope, lang }, false);

    // Run tests
    const testResult = await this.shadowManager.runTestsInWorktree(worktreePath);

    // Get diff
    const diff = await this.shadowManager.getDiff(worktreePath);

    const proposal: AdmissionProposal = {
      id: proposalId,
      kind: 'code',
      title,
      description,
      worktreeId,
      diff,
      testResult,
      status: 'pending',
      createdAt: this.clock.now(),
      metadata: { ...metadata, codemodResult, pattern, replacement },
    };

    this.proposals.set(proposalId, proposal);
    return proposal;
  }

  /** Create a rule proposal. */
  async createRuleProposal(
    title: string,
    description: string,
    ruleCode: string,
    metadata: Record<string, unknown> = {}
  ): Promise<AdmissionProposal> {
    const proposalId = `prop-${this.clock.now()}-${this.rng.next().toString(36).slice(2, 8)}`;
    const worktreeId = `wt-${proposalId}`;

    const worktreePath = await this.shadowManager.createWorktree(worktreeId);

    // Write rule file
    const { resolve } = await import('node:path');
    const { writeFile } = await import('node:fs/promises');
    const { ensureParentDir } = await import('@senars/util/fs');
    const target = resolve(worktreePath, 'rules', `${title.toLowerCase().replace(/\s+/g, '-')}.ts`);
    await ensureParentDir(target);
    await writeFile(target, ruleCode, 'utf-8');

    const testResult = await this.shadowManager.runTestsInWorktree(worktreePath);
    const diff = await this.shadowManager.getDiff(worktreePath);

    const proposal: AdmissionProposal = {
      id: proposalId,
      kind: 'rule',
      title,
      description,
      worktreeId,
      diff,
      testResult,
      status: 'pending',
      createdAt: this.clock.now(),
      metadata,
    };

    this.proposals.set(proposalId, proposal);
    return proposal;
  }

  /** Submit proposal for external validation. */
  async submitForValidation(proposalId: string): Promise<{ passed: boolean; reason: string }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);

    const result = await this.config.externalRunner.validate(proposal);

    if (result.passed) {
      proposal.status = 'approved';
      proposal.approvedAt = this.clock.now();
      // In a real system, this would be set by the external runner
      proposal.approvedBy = 'external-runner';
    }

    return { passed: result.passed, reason: result.reason };
  }

  /** Request human approval. */
  async requestHumanApproval(proposalId: string): Promise<{ approved: boolean; feedback?: string }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);

    const result = await this.config.humanApproval.request(proposal);

    if (result.approved) {
      proposal.status = 'approved';
      proposal.approvedAt = this.clock.now();
      proposal.approvedBy = 'human';
    } else {
      proposal.status = 'rejected';
    }

    return result;
  }

  /** Merge approved proposal. */
  async mergeProposal(proposalId: string): Promise<{ merged: boolean; reason: string }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);

    if (proposal.status !== 'approved') {
      return { merged: false, reason: `Proposal not approved: ${proposal.status}` };
    }

    const merged = await this.shadowManager.mergeWorktree(proposal.worktreeId);

    if (merged) {
      proposal.status = 'merged';
      proposal.mergedAt = this.clock.now();
    }

    return { merged, reason: merged ? 'Merged successfully' : 'Merge failed' };
  }

  /** Rollback a merged proposal. */
  async rollbackProposal(proposalId: string, reason: string): Promise<{ rolledBack: boolean; reason: string }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) throw new Error(`Proposal not found: ${proposalId}`);

    if (proposal.status !== 'merged') {
      return { rolledBack: false, reason: `Proposal not merged: ${proposal.status}` };
    }

    // Create a rollback worktree
    const rollbackWorktreeId = `rollback-${proposalId}-${this.clock.now()}`;
    const rollbackPath = await this.shadowManager.createWorktree(rollbackWorktreeId);

    // Apply reverse diff (simplified - in practice would use git revert)
    const { code } = await runProcess('git', ['revert', '--no-commit', 'HEAD'], { cwd: rollbackPath });

    if (code !== 0) {
      await this.shadowManager.cleanupWorktree(rollbackWorktreeId);
      return { rolledBack: false, reason: 'Failed to create rollback commit' };
    }

    const testResult = await this.shadowManager.runTestsInWorktree(rollbackPath);

    if (!testResult.success) {
      await this.shadowManager.cleanupWorktree(rollbackWorktreeId);
      return { rolledBack: false, reason: 'Rollback failed tests' };
    }

    const merged = await this.shadowManager.mergeWorktree(rollbackWorktreeId);

    if (merged) {
      proposal.status = 'rolled-back';
      proposal.rollbackReason = reason;
      return { rolledBack: true, reason: 'Rollback merged' };
    }

    return { rolledBack: false, reason: 'Rollback merge failed' };
  }

  /** Get proposal. */
  getProposal(id: string): AdmissionProposal | undefined {
    return this.proposals.get(id);
  }

  /** Get all proposals. */
  getAllProposals(): AdmissionProposal[] {
    return Array.from(this.proposals.values());
  }

  /** Get proposals by status. */
  getProposalsByStatus(status: AdmissionProposal['status']): AdmissionProposal[] {
    return Array.from(this.proposals.values()).filter(p => p.status === status);
  }

  /** Clean up expired proposals. */
  cleanupExpired(): number {
    const now = this.clock.now();
    let cleaned = 0;

    for (const [id, proposal] of this.proposals) {
      if (now - proposal.createdAt > this.config.proposalTtl) {
        // Clean up worktree if still exists
        if (this.shadowManager.getWorktreePath(proposal.worktreeId)) {
          this.shadowManager.cleanupWorktree(proposal.worktreeId).catch(() => {});
        }
        this.proposals.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /** Get statistics. */
  getStats(): {
    total: number;
    byStatus: Record<AdmissionProposal['status'], number>;
    byKind: Record<string, number>;
  } {
    const stats = {
      total: this.proposals.size,
      byStatus: {
        pending: 0,
        approved: 0,
        rejected: 0,
        merged: 0,
        'rolled-back': 0,
      } as Record<AdmissionProposal['status'], number>,
      byKind: {} as Record<string, number>,
    };

    for (const proposal of this.proposals.values()) {
      stats.byStatus[proposal.status]++;
      stats.byKind[proposal.kind] = (stats.byKind[proposal.kind] ?? 0) + 1;
    }

    return stats;
  }
}

/** Create admission machinery. */
export function createAdmissionMachinery(
  config: AdmissionMachineryConfig,
  clock?: Clock,
  rng?: RNG
): AdmissionMachinery {
  return new AdmissionMachinery(config, clock, rng);
}

/** Default external runner (runs CI in shadow worktree). */
export class DefaultExternalRunner implements ExternalRunner {
  private shadowManager: ShadowWorktreeManager;

  constructor(shadowManager: ShadowWorktreeManager) {
    this.shadowManager = shadowManager;
  }

  async validate(proposal: AdmissionProposal): Promise<{ passed: boolean; reason: string; evidence: Record<string, unknown> }> {
    // Re-run tests in the worktree to validate
    const worktreePath = this.shadowManager.getWorktreePath(proposal.worktreeId);
    if (!worktreePath) {
      return { passed: false, reason: 'Worktree not found', evidence: {} };
    }

    const testResult = await this.shadowManager.runTestsInWorktree(worktreePath);

    return {
      passed: testResult.success,
      reason: testResult.success ? 'All tests passed' : `Tests failed: ${testResult.failed}/${testResult.total}`,
      evidence: {
        testPassed: testResult.testPassed,
        typecheckPassed: testResult.typecheckPassed,
        lintPassed: testResult.lintPassed,
        passed: testResult.passed,
        failed: testResult.failed,
        total: testResult.total,
      },
    };
  }

  async getHistory(proposalId: string): Promise<{ passed: boolean; reason: string; timestamp: TimestampMs }[]> {
    // In a real implementation, this would query a persistent log
    return [];
  }
}

/** Default human approval (requires manual intervention). */
export class DefaultHumanApproval implements HumanApproval {
  private approvals: Map<string, { approved: boolean; feedback?: string; timestamp: TimestampMs }> = new Map();

  async request(proposal: AdmissionProposal): Promise<{ approved: boolean; feedback?: string }> {
    // In a real implementation, this would notify a human and wait
    // For now, return a simulated response
    const approval = this.approvals.get(proposal.id);
    if (approval) {
      return { approved: approval.approved, feedback: approval.feedback };
    }

    // Simulate pending approval
    return { approved: false, feedback: 'Awaiting human review' };
  }

  async getStatus(proposalId: string): Promise<{ approved: boolean; feedback?: string; timestamp: TimestampMs } | null> {
    return this.approvals.get(proposalId) ?? null;
  }

  /** Record approval (for testing/automation). */
  recordApproval(proposalId: string, approved: boolean, feedback?: string): void {
    this.approvals.set(proposalId, {
      approved,
      feedback,
      timestamp: Date.now(),
    });
  }
}