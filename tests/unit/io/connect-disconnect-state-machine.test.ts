/**
 * The connect/disconnect state machine, once, in `BaseConnection`.
 *
 * Falsifies that the funnel is the same for every transport: a failure is metered
 * and settles on `disconnected` rather than parking in `connecting`, a second
 * `connect()` is a no-op, and a teardown that throws still leaves the connection
 * closed.
 */

import { BaseConnection } from '@senars/io';
import { type ConnectionConfig, type ConnectionState, Logger } from '@senars/util';
import { describe, expect, it } from 'vitest';

const silentLogger = (): Logger => new Logger({ level: 'error', format: 'text' }).child('probe');

class ProbeConnection extends BaseConnection {
  readonly type = 'probe';
  openCalls = 0;
  closeCalls = 0;

  constructor(
    private readonly onOpen: () => Promise<void> | void = () => undefined,
    private readonly onClose: () => Promise<void> | void = () => undefined
  ) {
    const logger = silentLogger();
    super({ id: 'p1', type: 'probe', config: {} } as ConnectionConfig, {
      emit: () => undefined,
      logger,
    });
    this.logger = logger;
  }

  override connect(): Promise<void> {
    return this.runConnect('PROBE_CONNECT_ERROR', async () => {
      this.openCalls++;
      await this.onOpen();
    });
  }

  override disconnect(): Promise<void> {
    return this.runDisconnect(async () => {
      this.closeCalls++;
      await this.onClose();
    });
  }

  send(): Promise<void> {
    return Promise.resolve();
  }
}

const recordStates = (connection: ProbeConnection): ConnectionState[] => {
  const seen: ConnectionState[] = [];
  connection.onStateChange((state) => seen.push(state));
  return seen;
};

describe('BaseConnection connect/disconnect funnel', () => {
  it('walks connecting -> connected and does the open work once', async () => {
    const connection = new ProbeConnection();
    const seen = recordStates(connection);

    await connection.connect();

    expect(connection.state).toBe('connected');
    expect(connection.openCalls).toBe(1);
    expect(seen).toEqual(['connecting', 'connected']);
  });

  it('ignores a second connect while already connected', async () => {
    const connection = new ProbeConnection();

    await connection.connect();
    await connection.connect();

    expect(connection.openCalls).toBe(1);
  });

  it('meters a failed connect, settles on disconnected, and rethrows', async () => {
    const connection = new ProbeConnection(() => {
      throw new Error('open refused');
    });
    const errors: { message: string; context?: Record<string, unknown> }[] = [];
    connection.onError((error) => errors.push({ message: error.message, context: error.context }));

    await expect(connection.connect()).rejects.toThrow('open refused');

    expect(connection.state).toBe('disconnected');
    expect(connection.getStatus().errorCount).toBe(1);
    expect(errors).toHaveLength(1);
    // The transport's own code rides in context; the class code is the family.
    expect(errors[0]?.context?.code).toBe('PROBE_CONNECT_ERROR');
  });

  it('recovers after a failed connect rather than staying parked', async () => {
    let shouldFail = true;
    const connection = new ProbeConnection(() => {
      if (shouldFail) throw new Error('transient');
    });

    await expect(connection.connect()).rejects.toThrow('transient');
    shouldFail = false;
    await connection.connect();

    expect(connection.state).toBe('connected');
    expect(connection.openCalls).toBe(2);
  });

  it('leaves the connection closed when teardown throws', async () => {
    const connection = new ProbeConnection(undefined, () => {
      throw new Error('close refused');
    });
    await connection.connect();

    await expect(connection.disconnect()).rejects.toThrow('close refused');

    expect(connection.state).toBe('disconnected');
  });

  it('ignores a disconnect when already disconnected', async () => {
    const connection = new ProbeConnection();

    await connection.disconnect();

    expect(connection.closeCalls).toBe(0);
    expect(connection.state).toBe('disconnected');
  });

  it('reconnects from a closed state by connecting again', async () => {
    const connection = new ProbeConnection();
    await connection.connect();
    await connection.disconnect();

    await connection.reconnect();

    expect(connection.openCalls).toBe(2);
    expect(connection.state).toBe('connected');
  });

  it('treats reconnect while connected as already done', async () => {
    const connection = new ProbeConnection();
    await connection.connect();

    await connection.reconnect();

    expect(connection.openCalls).toBe(1);
    expect(connection.closeCalls).toBe(0);
  });
});