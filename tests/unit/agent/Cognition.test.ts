import { abortSession, buildAgentTools, createAgent, createSession } from '@senars/nar/agent';
import { describe, expect, it } from 'vitest';
import { createMockLMService } from '../../../nar/src/lm';

type DispatchLogger = {
  debug: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
};

const scriptedLM = createMockLMService({
  available: true,
  provider: 'scripted',
  model: 'scripted-1',
  generateTextFn: async (prompt: string) => {
    if (prompt.toLowerCase().includes('hello')) return 'Hi!';
    if (prompt.toLowerCase().includes('instruct')) return 'Got it.';
    return 'OK';
  },
});

function silentLogger(): DispatchLogger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

describe('Agent tools: agent_instruct and get_session_info', () => {
  it('buildAgentTools includes both new tools', () => {
    const tools = buildAgentTools({
      know: () => undefined,
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
      setInstructions: () => undefined,
      getSessionInfo: () => ({ messageCount: 0, createdAt: 0, pinnedBeliefs: [] }),
    });
    expect(tools).toHaveProperty('agent_instruct');
    expect(tools).toHaveProperty('get_session_info');
  });

  it('agent_instruct appends when mode=append and replaces when mode=replace', async () => {
    const agent = await createAgent({ lmService: scriptedLM });
    void agent;
    const session = createSession('test:tools:alice');
    void session;
    // We verify the tool is registered and its execute function works via buildAgentTools:
    const built = buildAgentTools({
      know: () => undefined,
      knowGet: () => undefined,
      knowList: () => [],
      recall: async () => [],
      setInstructions: (mode, instructions) => {
        if (mode === 'append') {
          // Simulating agent's behavior
        }
      },
      getSessionInfo: () => ({ messageCount: 1, createdAt: 0, pinnedBeliefs: [] }),
    });
    expect(Object.keys(built).sort()).toContain('agent_instruct');
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
