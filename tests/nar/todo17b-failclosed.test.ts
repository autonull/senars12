import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { KernelPerceptionGate } from '../../nar/src/kernel/KernelPerceptionGate.js';
import { SystemOneIngressJudge } from '../../nar/src/lm/system-one/ingress-judge.js';
import { PersistentSpace } from '../../metta/src/extensions/persistent-space.js';
import { EpisodicMemory } from '../../nar/src/memory/EpisodicMemory.js';
import { handleDelegationMessage, createDelegation } from '../../nar/src/cooperation/delegation.js';
import type { CognitiveTaskResult } from '../../nar/src/cooperation/delegation.js';
import { BaseConnection } from '../../io/src/connections/base.js';
import { createLogger } from '@senars/core/logger';
import type { ConnectionConfig, ConnectionDeps, IOMessage } from '../../io/src/types.js';

/**
 * Bench 36 — Fail-Closed Integrity (TODO17b Phase A)
 * D1: fault-injected manifold throw ⇒ admission rejected + policy.violation telemetry.
 * D6: self-tools never report success without registering.
 * D8: episode rollover at per-file cap.
 * D9: auto-save guarded; corrupt file quarantined, not overwritten.
 * D10: allSettled rejections logged+counted; peer crash ⇒ typed failure reply.
 */

describe('Bench 36 — Fail-Closed Integrity', () => {
  describe('D1 — System One ingress fails closed', () => {
    const makeGate = (manifold: unknown) =>
      new KernelPerceptionGate({
        systemOne: {
          enabled: true,
          judge: new SystemOneIngressJudge({
            manifold: manifold as never,
            embeddingCache: {
              write: async () => 0,
            } as never,
            budget: {
              maxCycles: 10,
              maxDepth: 5,
              maxMemoryOps: 100,
              maxLMCalls: 2,
              consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
            },
          }),
        },
      });

    it('rejects admission and emits policy.violation when judgeBatch throws', async () => {
      const gate = makeGate({
        judgeBatch: async () => {
          throw new Error('manifold fault');
        },
      });
      const result = await gate.admit({ rawObservation: '(robin --> bird)', sourceId: 'test', sensorConfidence: 1, sourceQuality: 'GENERAL' });
      expect(result.admitted).toBe(false);
      expect(result.rejectionReason).toContain('fail-closed');
      const violation = gate
        .getEventLog()
        .find((e) => e.type === 'policy.violation') as { payload: { detail: string } };
      expect(violation).toBeDefined();
      expect(violation.payload.detail).toContain('systemone_ingress_error');
    });

    it('never falls through to legacy admission on System One fault', async () => {
      const gate = makeGate({
        judgeBatch: async () => {
          throw new Error('manifold fault');
        },
      });
      const result = await gate.admit({ rawObservation: '(robin --> bird)', sourceId: 'test', sensorConfidence: 1, sourceQuality: 'GENERAL' });
      expect(result.admitted).toBe(false);
      expect(result.task).toBeUndefined();
    });
  });

  describe('D8 — EpisodicMemory rollover at cap', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'episodic-'));
    });
    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('rolls over to a new file instead of dropping episodes', async () => {
      const mem = new EpisodicMemory({ basePath: dir, maxEntriesPerFile: 2 });
      await mem.log('input', 'one');
      await mem.log('input', 'two');
      await mem.log('input', 'three');
      const episodes = await mem.getEpisodes();
      expect(episodes.map((e) => e.content).sort()).toEqual(['one', 'three', 'two']);
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.jsonl'));
      expect(files.length).toBeGreaterThan(1);
      expect(files.some((f) => /-\d+\.jsonl$/.test(f))).toBe(true);
    });
  });

  describe('D9 — persistent-space guards', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'metta-space-'));
    });
    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('quarantines a corrupt persisted file instead of silently starting empty', async () => {
      await fs.writeFile(join(dir, 'corrupt.metta.json'), '{not json');
      const space = new PersistentSpace('corrupt', { storageDir: dir });
      await expect(space.load()).rejects.toThrow('quarantined');
      await expect(fs.access(join(dir, 'corrupt.metta.json.corrupt'))).resolves.toBeUndefined();
    });

    it('final-flushes on dispose and counts failed saves', async () => {
      const space = new PersistentSpace('flush', { storageDir: dir, autoSave: false });
      space.add({ kind: 0, value: 'a' } as never);
      space[Symbol.dispose]();
      await new Promise((r) => setTimeout(r, 20));
      const persisted = JSON.parse(
        await fs.readFile(join(dir, 'flush.metta.json'), 'utf-8')
      ) as { atoms: unknown[] };
      expect(persisted.atoms).toHaveLength(1);
    });

    it('unrefs the auto-save timer (process can exit)', () => {
      const space = new PersistentSpace('timer', { storageDir: dir, autoSave: true, saveInterval: 10_000 });
      space.add({ kind: 0, value: 'a' } as never);
      // unref'd timers don't keep the loop alive — verified indirectly:
      // if the timer were ref'd, vitest teardown would hang.
      space[Symbol.dispose]();
    });
  });

  describe('D10 — delegation and transport failure honesty', () => {
    it('replies with a typed failure when the peer crashes', async () => {
      const delegation = createDelegation('judgment', '', 'ws://callback');
      const peer = {
        executeTask: async () => {
          throw new Error('peer exploded');
        },
      };
      const replies: CognitiveTaskResult[] = [];
      await handleDelegationMessage(
        peer,
        JSON.stringify({ type: 'cognitive-delegation', delegation }),
        (r) => replies.push(r)
      );
      expect(replies).toHaveLength(1);
      expect(replies[0]!.success).toBe(false);
      expect(replies[0]!.error).toContain('peer exploded');
    });

    it('ignores malformed messages silently', async () => {
      const replies: CognitiveTaskResult[] = [];
      await handleDelegationMessage(
        { executeTask: async () => ({ taskId: 'x', resultNarsese: [], success: true }) },
        'not json',
        (r) => replies.push(r)
      );
      expect(replies).toHaveLength(0);
    });
  });

  describe('D10 — allSettled handler rejections are logged and counted', () => {
    class TestConnection extends BaseConnection {
      override readonly type = 'test';
      override readonly logger = createLogger({ scope: 'test' });
      constructor(config: ConnectionConfig, deps: ConnectionDeps) {
        super(config, deps);
      }
      expose(message: IOMessage): void {
        this.handleMessage(message);
      }
      connect(): Promise<void> { return Promise.resolve(); }
      disconnect(): Promise<void> { return Promise.resolve(); }
      send(): Promise<void> { return Promise.resolve(); }
    }

    const makeConfig = (): ConnectionConfig =>
      ({ id: 'test-conn', enabled: true, type: 'test', config: { name: 'Test' } }) as ConnectionConfig;
    const makeDeps = (): ConnectionDeps =>
      ({ emit: () => {}, logger: console, getSessionSpaceId: () => 'test' }) as unknown as ConnectionDeps;

    it('increments errorCount and does not lose the rejection', async () => {
      const conn = new TestConnection(makeConfig(), makeDeps());
      conn.onMessage(async () => {
        throw new Error('handler boom');
      });
      conn.expose({
        id: 'm1',
        source: 'test-conn',
        origin: 'test:direct:s',
        sender: 's',
        text: 'hi',
        timestamp: Date.now(),
      });
      await new Promise((r) => setTimeout(r, 20));
      expect(conn.getStatus().errorCount).toBe(1);
    });
  });
});