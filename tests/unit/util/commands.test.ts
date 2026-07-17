import { CommandRegistry } from '@senars/util/commands';
import type { CommandContext, CommandDefinition } from '@senars/util/commands';
import type { Connection } from '@senars/util/types/transport';
import { describe, expect, it, vi } from 'vitest';

function dummyConnection(): Connection {
  return {
    id: 'c1',
    name: 'c1',
    type: 'cli',
    state: 'idle',
    connect: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    send: vi.fn(),
    onMessage: vi.fn(),
    removeMessageHandler: vi.fn(),
    onStateChange: vi.fn(),
    onError: vi.fn(),
    getStatus: () => ({ state: 'idle', messageCount: 0, errorCount: 0 }),
    reconfigure: vi.fn(),
  };
}

function cmd(
  def: Partial<CommandDefinition> & Pick<CommandDefinition, 'name' | 'execute'>
): CommandDefinition {
  return {
    description: '',
    usage: '',
    ...def,
  };
}

describe('CommandRegistry', () => {
  it('registers and retrieves by name', () => {
    const reg = new CommandRegistry();
    const c = cmd({ name: 'ping', execute: async () => 'pong' });
    reg.register(c);
    expect(reg.get('ping')).toBe(c);
    expect(reg.commands.get('ping')).toBe(c);
  });

  it('registers aliases that resolve to the same definition', () => {
    const reg = new CommandRegistry();
    const c = cmd({ name: 'help', aliases: ['h', '?'], execute: async () => 'ok' });
    reg.register(c);
    expect(reg.get('h')).toBe(c);
    expect(reg.get('?')).toBe(c);
    expect(reg.get('help')).toBe(c);
  });

  it('executes a command with args and context', async () => {
    const reg = new CommandRegistry();
    const ctx: CommandContext = { connection: dummyConnection() };
    const spy = vi.fn(
      async (args: string[], c: CommandContext) => `${args.join(',')}:${c.connection.id}`
    );
    reg.register(cmd({ name: 'echo', execute: spy }));
    const out = await reg.execute('echo', ['a', 'b'], ctx);
    expect(out).toBe(`a,b:${ctx.connection.id}`);
    expect(spy).toHaveBeenCalledWith(['a', 'b'], ctx);
  });

  it('throws on unknown command execute', async () => {
    const reg = new CommandRegistry();
    await expect(reg.execute('nope', [], { connection: dummyConnection() })).rejects.toThrow(
      /Unknown command/
    );
  });

  it('overwrites when re-registering the same name', () => {
    const reg = new CommandRegistry();
    const a = cmd({ name: 'x', execute: async () => 'a' });
    const b = cmd({ name: 'x', execute: async () => 'b' });
    reg.register(a);
    reg.register(b);
    expect(reg.get('x')).toBe(b);
    expect(reg.commands.size).toBe(1);
  });

  it('exposes the live commands map', () => {
    const reg = new CommandRegistry();
    reg.register(cmd({ name: 'x', execute: async () => 'a' }));
    expect(reg.commands).toBeInstanceOf(Map);
    expect(reg.commands.size).toBe(1);
  });
});
