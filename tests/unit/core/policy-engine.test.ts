import { PolicyEngine } from '@senars/core';
import { describe, expect, it } from 'vitest';

const policy = (sandboxDir?: string) =>
  new PolicyEngine(sandboxDir === undefined ? {} : { sandboxDir });

describe('PolicyEngine', () => {
  it('admits what is inside the sandbox', () => {
    const engine = policy('/ws');
    expect(engine.checkFileAccess('/ws/a.ts').allowed).toBe(true);
    expect(engine.checkFileAccess('/ws').allowed).toBe(true);
  });

  it('refuses a sibling that merely shares a name prefix', () => {
    // `./sandbox-evil` starts with `./sandbox`. The motor workspace and the fs
    // tool both refuse it, because they share `containsPath`; this predicate was
    // a raw `startsWith` and admitted it.
    expect(policy('/ws').checkFileAccess('/ws-evil/keys').allowed).toBe(false);
    expect(policy('/ws').checkFileAccess('/wsx').allowed).toBe(false);
  });

  it('refuses a relative escape out of the sandbox', () => {
    // Both sides resolve before containment, so `..` cannot climb out. Containment
    // alone answers about literal prefixes and would have waved this through.
    const engine = policy('/ws');
    expect(engine.checkFileAccess('/ws/../etc/passwd').allowed).toBe(false);
    expect(engine.checkFileAccess('/ws/nested/../../secrets').allowed).toBe(false);
    expect(engine.checkFileAccess('/ws/nested/ok.ts').allowed).toBe(true);
  });

  it('resolves a relative sandbox against the cwd, both ways', () => {
    // The default policy's `./sandbox` and a caller writing `sandbox/a.ts` name
    // the same directory; they must not disagree about that.
    const engine = policy();
    expect(engine.checkFileAccess('./sandbox/a.ts').allowed).toBe(true);
    expect(engine.checkFileAccess('sandbox/a.ts').allowed).toBe(true);
    expect(engine.checkFileAccess('./sandbox-evil/a.ts').allowed).toBe(false);
    expect(engine.checkFileAccess('/etc/passwd').allowed).toBe(false);
  });

  it('normalizes separators so a windows path is judged the same way', () => {
    expect(policy('/ws').checkFileAccess('/ws\\nested\\a.ts').allowed).toBe(true);
    expect(policy('/ws').checkFileAccess('/ws-evil\\a.ts').allowed).toBe(false);
  });

  it('still applies the deny patterns inside the sandbox', () => {
    const engine = new PolicyEngine({ sandboxDir: '/ws', denyFiles: ['.env'] });
    expect(engine.checkFileAccess('/ws/a.ts').allowed).toBe(true);
    expect(engine.checkFileAccess('/ws/.env').allowed).toBe(false);
    expect(engine.checkFileAccess('/ws/.env').reason).toMatch(/deny pattern/);
  });

  it('has no sandbox to enforce when none is configured', () => {
    const engine = new PolicyEngine({ sandboxDir: undefined });
    expect(engine.checkFileAccess('/anywhere/at/all').allowed).toBe(true);
  });
});
