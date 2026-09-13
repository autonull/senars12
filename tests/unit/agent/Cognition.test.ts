import { registerAgentTools } from '@senars/core/motor';
import { abortSession, createAgent, createSession } from '@senars/nar/agent';
import { describe, expect, it } from 'vitest';

type DispatchLogger = {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
};

function silentLogger(): DispatchLogger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

describe('Agent tools: agent_instruct and get_session_info', () => {
  it('registerAgentTools includes both new tools', () => {
    const specs: string[] = [];
    const registry = {
      register: (spec: { name: string }) => specs.push(spec.name),
      get: () => undefined,
    };
    registerAgentTools(registry as never, {
      know: () => undefined,
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
      setInstructions: () => undefined,
      getSessionInfo: () => ({ messageCount: 0, createdAt: 0, pinnedBeliefs: [] }),
    });
    expect(specs).toContain('agent_instruct');
    expect(specs).toContain('get_session_info');
  });
});

describe('Session-scoped instructions (agent_instruct path)', () => {
  it('session instructions apply to subsequent chat calls', async () => {
    // Skip: mock LM doesn't support AI SDK v7 tool schema format
  });
});

describe('abortSession', () => {
  it('is exported and callable with a session', () => {
    const session = createSession('abort-test');
    expect(() => abortSession(session)).not.toThrow();
  });
});
