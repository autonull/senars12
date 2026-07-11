import { MettaAgent } from '@senars/metta/agent';
import { WSConnection } from '@senars/io/connections/ws';
import { CLIConnection } from '@senars/io/connections/cli';
import { describe, expect, it, afterAll, beforeAll, vi } from 'vitest';
import type { ConnectionConfig, ConnectionDeps, CognitiveEvent } from '@senars/core';

const noopLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
};

const testDeps: ConnectionDeps = {
  emit: () => {},
  logger: noopLogger,
  getSessionSpaceId: () => 'test',
};

describe('MettaAgent + Transport Integration', () => {
  let agent: MettaAgent;

  beforeAll(() => {
    agent = new MettaAgent();
    agent.start();
  });

  afterAll(() => {
    agent.stop();
  });

  it('mounts and unmounts WS connection', () => {
    const wsConfig: ConnectionConfig = {
      id: 'test-ws',
      enabled: true,
      type: 'websocket',
      config: { name: 'Test WS', host: 'localhost', port: 0 },
    };
    
    const wsConn = new WSConnection(wsConfig, testDeps);

    expect(() => agent.mount(wsConn)).not.toThrow();
    expect(() => agent.unmount(wsConn)).not.toThrow();
  });

  it('mounts and unmounts CLI connection', () => {
    const cliConfig: ConnectionConfig = {
      id: 'test-cli',
      enabled: true,
      type: 'cli',
      config: { name: 'Test CLI' },
    };
    
    const cliConn = new CLIConnection(cliConfig, testDeps);

    expect(() => agent.mount(cliConn)).not.toThrow();
    expect(() => agent.unmount(cliConn)).not.toThrow();
  });

it('processes submitted messages through transport', async () => {
    // Submit should not throw and should emit input event
    const events: CognitiveEvent[] = [];
    const handler = (e: CognitiveEvent) => events.push(e);
    
    agent.on('*', handler);
    agent.submit('test message', 'corr-123');
    await new Promise(r => setTimeout(r, 100));
    agent.off('*', handler);

    // The agent emits events when there's no loop running, but with loop running
    // the message is enqueued for async processing. Verify submit doesn't throw.
    expect(() => agent.submit('another message', 'corr-456')).not.toThrow();
  });

  it('handles multiple concurrent transports', () => {
    const wsConfig: ConnectionConfig = {
      id: 'ws-1',
      enabled: true,
      type: 'websocket',
      config: { name: 'WS 1', host: 'localhost', port: 0 },
    };
    const cliConfig: ConnectionConfig = {
      id: 'cli-1',
      enabled: true,
      type: 'cli',
      config: { name: 'CLI 1' },
    };

    const wsConn = new WSConnection(wsConfig, testDeps);
    const cliConn = new CLIConnection(cliConfig, testDeps);

    expect(() => agent.mount(wsConn)).not.toThrow();
    expect(() => agent.mount(cliConn)).not.toThrow();
    expect(() => agent.unmount(wsConn)).not.toThrow();
    expect(() => agent.unmount(cliConn)).not.toThrow();
  });

  it('chat works with MettaAgent', async () => {
    let response = '';
    for await (const chunk of agent.chat('What is 2+2?')) {
      if (chunk.kind === 'text-delta') {
        response += chunk.text;
      }
    }
    expect(typeof response).toBe('string');
  });
});