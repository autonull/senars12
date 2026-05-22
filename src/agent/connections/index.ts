/**
 * Connection Adapters for AIAgent
 * 
 * Bridges the gap between AIAgent and connection adapters.
 * This is the key integration for Phase 2 of AI.md plan.
 */

import type {AIAgent} from '../AIAgent.js';
import type {
  Connection,
  ConnectionConfig,
  IOMessage,
  Logger,
} from '../../io/types.js';
import {ConnectionManager} from '../../io/connection-manager.js';
import {createLogger} from '../../nar/logger/index.js';
import {CLIConnection} from '../../io/connections/cli.js';
import {IRCConnection} from '../../io/connections/irc.js';
import {WSConnection} from '../../io/connections/ws.js';
import {HTTPConnection} from '../../io/connections/http.js';
import {MCPConnection} from '../../io/connections/mcp.js';
import {SeNARSMCPServer} from '../../api/mcp-server.js';
import {registerNARToolsAsMCP, registerAgentAPI} from '../../api/mcp-tools.js';
import {registerMCPPrompts} from '../../api/mcp-prompts.js';
import {registerMCPResources} from '../../api/mcp-resources.js';
import {registerScenarioAPIs, registerExperimentAPIs, registerSelfAnalysisAPIs, registerRegressionAPIs} from '../../api/agent-api.js';
import {ScenarioRunner} from '../scenarios/ScenarioRunner.js';
import {ScoringEngine} from '../scenarios/ScoringEngine.js';
import {ExperimentRunner} from '../experiments/ExperimentRunner.js';
import {RegressionTracker} from '../scenarios/RegressionTracker.js';
import {SelfAnalyzer} from '../SelfAnalyzer.js';
import type {NAR} from '../../nar/nar.js';

export interface ConnectionAdapterConfig {
  id: string;
  type: 'cli' | 'irc' | 'websocket' | 'http' | 'mcp';
  enabled: boolean;
  config: Record<string, unknown>;
  authSecret?: string;
}

export interface AIAgentDeps {
  nar?: NAR;
  episodicMemory?: import('../../nar/memory/EpisodicMemory.js').EpisodicMemory;
  logger?: Logger;
}

/**
 * Creates connection adapters for AIAgent
 * Handles all connection types: CLI, IRC, WebSocket, HTTP, MCP
 */
export class AIAgentConnectionManager {
  private readonly agent: AIAgent;
  private readonly nar?: NAR;
  private readonly logger: Logger;
  private mcpServer?: SeNARSMCPServer;
  private scenarioRunner?: ScenarioRunner;
  private experimentRunner?: ExperimentRunner;
  private selfAnalyzer?: SelfAnalyzer;
  private regressionTracker?: RegressionTracker;
  private connections: Connection[] = [];

  constructor(agent: AIAgent, deps: AIAgentDeps = {}) {
    this.agent = agent;
    this.nar = deps.nar;
    this.logger = deps.logger ?? createLogger({scope: 'agent:connections'});
  }

  /**
   * Add multiple connections from config
   */
  async addConnections(configs: ConnectionAdapterConfig[]): Promise<void> {
    for (const config of configs) {
      if (!config.enabled) continue;

      try {
        await this.addConnection(config);
        this.logger.info(`Added ${config.type} connection: ${config.id}`);
      } catch (error) {
        this.logger.error(`Failed to add ${config.type} connection: ${config.id}`, error as Error);
      }
    }
  }

  /**
   * Add a single connection
   */
  async addConnection(config: ConnectionAdapterConfig): Promise<void> {
    const connection = await this.createConnection(config);
    await connection.connect();
    this.connections.push(connection);
  }

  /**
   * Create connection instance based on type
   */
  private async createConnection(config: ConnectionAdapterConfig): Promise<Connection> {
    const connectionConfig: ConnectionConfig = {
      id: config.id,
      enabled: config.enabled,
      type: config.type,
      config: config.config,
      authSecret: config.authSecret,
    };

    const deps = {
      nar: this.nar!,
      emit: (event: string, data: unknown) => {
        this.logger.debug(`Event: ${event}`, data as Record<string, unknown>);
      },
      logger: this.logger,
    };

    let connection: Connection;

    switch (config.type) {
      case 'cli':
        connection = new CLIConnection(connectionConfig, deps);
        break;
      case 'irc':
        connection = new IRCConnection(connectionConfig, deps);
        break;
      case 'websocket':
        connection = new WSConnection(connectionConfig, deps);
        break;
      case 'http':
        connection = new HTTPConnection(connectionConfig, deps);
        break;
      case 'mcp':
        connection = new MCPConnection(connectionConfig, deps);
        break;
      default:
        throw new Error(`Unknown connection type: ${config.type}`);
    }

    // Set up message handler
    connection.onMessage(async (message: IOMessage) => {
      await this.handleMessage(connection, message);
    });

    return connection;
  }

  /**
   * Handle incoming message from connection
   */
  private async handleMessage(connection: Connection, message: IOMessage): Promise<void> {
    try {
      this.logger.info(`Message from ${connection.id}: ${message.text.slice(0, 50)}...`);

      // TODO: Create conversation state per channel/user
      const {ConversationState} = await import('../ConversationState.js');
      const botConfig: any = {
        reasoning: {
          autoTrigger: true,
          triggerThreshold: 0.5,
          triggerCooldown: 3,
          maxStepsPerTrigger: 5,
          backgroundReasoning: false,
          backgroundIntervalMs: 60000,
          lmDriven: true,
        },
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
        conversation: {maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50},
        pipeline: {maxLoops: 10, stageTimeoutMs: 5000, enableLoopBack: false, loopBackOn: []},
        directives: {builtIn: true},
        nlParsers: {builtIn: true},
        classifier: {},
        lmRules: {enabled: true, rules: []},
        tui: {typingIndicator: false, colors: true, compactMode: false, statusBar: true},
        prompts: {},
      };
      const conversation = new ConversationState(botConfig);

      const context = {
        sender: message.sender,
        connectionType: connection.type,
        conversation,
      };

      const response = await this.agent.chat(message.text, context);

      if (response) {
        await connection.send(message.sender, response);
      }
    } catch (error) {
      this.logger.error(`Error handling message from ${connection.id}`, error as Error);
      await connection.send(message.sender, `Error: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize MCP server with all capabilities
   */
  async initializeMCP(): Promise<void> {
    if (!this.nar) {
      this.logger.warn('NARS not available, skipping MCP initialization');
      return;
    }

    if (process.env.SENARS_MCP_ENABLED !== 'true') {
      this.logger.info('MCP disabled by environment');
      return;
    }

    try {
      this.mcpServer = new SeNARSMCPServer({
        name: 'senars-bot',
        version: '1.0.0',
        transport: (process.env.SENARS_MCP_TRANSPORT as any) || 'stdio',
      });

      const adapter = this.mcpServer.getAdapter();

      // Register NARS tools
      registerNARToolsAsMCP(this.nar, adapter);
      registerAgentAPI({}, adapter);
      registerMCPPrompts(adapter);
      registerMCPResources(adapter, this.nar);

      // Initialize scenario/experiment runners
      const scoringEngine = new ScoringEngine();
      this.scenarioRunner = new ScenarioRunner(this.nar);
      this.experimentRunner = new ExperimentRunner(this.nar, this.scenarioRunner);
      this.regressionTracker = new RegressionTracker();
      this.selfAnalyzer = new SelfAnalyzer(this.nar, undefined, this.scenarioRunner, this.experimentRunner);

      // Register APIs
      registerScenarioAPIs(this.scenarioRunner);
      registerExperimentAPIs(this.experimentRunner);
      registerSelfAnalysisAPIs(this.selfAnalyzer);
      registerRegressionAPIs(this.regressionTracker);

      await this.mcpServer.start();
      this.logger.info('MCP Server started with full capabilities');
    } catch (error) {
      this.logger.error('Failed to initialize MCP', error as Error);
    }
  }

  /**
   * Start all connections
   */
  async start(): Promise<void> {
    if (this.mcpServer) {
      await this.initializeMCP();
    }
  }

  /**
   * Stop all connections
   */
  async stop(): Promise<void> {
    for (const connection of this.connections) {
      try {
        await connection.disconnect('shutdown');
      } catch (error) {
        this.logger.error(`Error disconnecting ${connection.id}`, error as Error);
      }
    }
    if (this.mcpServer) {
      await this.mcpServer.stop();
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connections: Array.from(this.connections).map(c => c.getStatus()),
      mcp: this.mcpServer ? {running: this.mcpServer.isServerRunning()} : undefined,
    };
  }
}

/**
 * Factory function to create connection configs from environment
 */
export function createConnectionConfigsFromEnv(): ConnectionAdapterConfig[] {
  const configs: ConnectionAdapterConfig[] = [];

  // CLI connection (always enabled for testing)
  configs.push({
    id: 'cli',
    type: 'cli',
    enabled: true,
    config: {},
  });

  // IRC connection
  if (process.env.SENARS_IRC_ENABLED === 'true') {
    configs.push({
      id: 'irc-main',
      type: 'irc',
      enabled: true,
      config: {
        server: process.env.SENARS_IRC_SERVER || 'irc.libera.chat',
        port: parseInt(process.env.SENARS_IRC_PORT || '6667'),
        nick: process.env.SENARS_IRC_NICK || 'senars-bot',
        channels: process.env.SENARS_IRC_CHANNELS?.split(',') || ['#senars'],
      },
      authSecret: process.env.SENARS_IRC_AUTH_SECRET,
    });
  }

  // WebSocket connection
  if (process.env.SENARS_WS_ENABLED === 'true') {
    configs.push({
      id: 'ws-main',
      type: 'websocket',
      enabled: true,
      config: {
        port: parseInt(process.env.SENARS_WS_PORT || '8080'),
      },
    });
  }

  // HTTP connection
  if (process.env.SENARS_HTTP_ENABLED === 'true') {
    configs.push({
      id: 'http-main',
      type: 'http',
      enabled: true,
      config: {
        port: parseInt(process.env.SENARS_HTTP_PORT || '8081'),
      },
    });
  }

  // MCP connection
  if (process.env.SENARS_MCP_ENABLED === 'true') {
    configs.push({
      id: 'mcp',
      type: 'mcp',
      enabled: true,
      config: {
        transport: process.env.SENARS_MCP_TRANSPORT || 'stdio',
      },
    });
  }

  return configs;
}
