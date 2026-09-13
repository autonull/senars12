import { createLogger } from '@senars/core';
import type { Connection, ConnectionConfig, ConnectionDeps, ConnectionFactory } from './types.js';

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private factories: Map<string, ConnectionFactory> = new Map();
  private readonly logger = createLogger({ scope: 'connections' });

  registerFactory(factory: ConnectionFactory): void {
    this.factories.set(factory.type, factory);
    this.logger.info(`Registered factory for connection type: ${factory.type}`);
  }

  async addConnection(config: ConnectionConfig, deps: ConnectionDeps): Promise<Connection> {
    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new Error(`No factory registered for connection type: ${config.type}`);
    }

    if (this.connections.has(config.id)) {
      throw new Error(`Connection with id ${config.id} already exists`);
    }

    const connection = factory.create(config, deps);
    this.connections.set(config.id, connection);

    if (config.enabled) {
      await connection.connect();
    }

    this.logger.info(`Added connection: ${config.id} (${config.type})`);
    return connection;
  }

  async removeConnection(id: string): Promise<void> {
    const connection = this.getConnectionOrThrow(id);
    await connection.disconnect('removed');
    this.connections.delete(id);
    this.logger.info(`Removed connection: ${id}`);
  }

  async enableConnection(id: string): Promise<void> {
    const connection = this.getConnectionOrThrow(id);
    if (connection.state === 'connected') return;

    if (connection.state === 'disconnected' || connection.state === 'idle') {
      await connection.connect();
    } else if (connection.state === 'error') {
      await connection.reconnect();
    }

    this.logger.info(`Enabled connection: ${id}`);
  }

  async disableConnection(id: string): Promise<void> {
    const connection = this.getConnectionOrThrow(id);
    if (connection.state === 'disconnected' || connection.state === 'idle') return;

    await connection.disconnect('disabled');
    this.logger.info(`Disabled connection: ${id}`);
  }

  async reconnectConnection(id: string): Promise<void> {
    const connection = this.getConnectionOrThrow(id);
    await connection.reconnect();
    this.logger.info(`Reconnected connection: ${id}`);
  }

  async shutdownAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];
    for (const connection of this.connections.values()) {
      if (connection.state !== 'disconnected' && connection.state !== 'idle') {
        disconnectPromises.push(
          connection.disconnect('shutdown').catch((err) => {
            this.logger.error(`Error disconnecting ${connection.id}`, err as Error);
          })
        );
      }
    }
    await Promise.allSettled(disconnectPromises);
    this.connections.clear();
    this.logger.info('Shutdown all connections');
  }

  getConnection(id: string): Connection | undefined {
    return this.connections.get(id);
  }

  getConnections(): ReadonlyMap<string, Connection> {
    return this.connections;
  }

  getConnectionsByType(type: string): Connection[] {
    return Array.from(this.connections.values()).filter((c) => c.type === type);
  }

  private getConnectionOrThrow(id: string): Connection {
    const connection = this.connections.get(id);
    if (!connection) throw new Error(`Connection not found: ${id}`);
    return connection;
  }
}
