/**
 * Connection Adapters for AIAgent
 *
 * Bridges the gap between AIAgent and connection adapters.
 */

import type {AIAgent} from '../AIAgent.js';
import type {
  Connection,
  ConnectionConfig,
  IOMessage,
  Logger,
} from '../../io/types.js';
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
import {ExperimentRunner} from '../experiments/ExperimentRunner.js';
import {RegressionTracker} from '../scenarios/RegressionTracker.js';
import {ReasoningAboutReasoning} from '../../nar/self/ReasoningAboutReasoning.js';
import type {NAR} from '../../nar/nar.js';
import {AutonomousScheduler} from '../AutonomousScheduler.js';
import {makeDefaultBotConfig} from '../../config/defaults.js';

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
  agenticLoop?: {
    reasoningStepsPerWake: number;
    wakeupIntervalMs: number;
    sleepIntervalMs: number;
    enableLMRules: boolean;
    effortLevel: number;
  };
}

export class AIAgentConnectionManager {
  private readonly agent: AIAgent;
  private readonly nar?: NAR;
  private readonly logger: Logger;
  private readonly agenticLoop?: AIAgentDeps['agenticLoop'];
  private scheduler?: AutonomousScheduler;
  private mcpServer?: SeNARSMCPServer;
  private scenarioRunner?: ScenarioRunner;
  private experimentRunner?: ExperimentRunner;
  private selfAnalyzer?: ReasoningAboutReasoning;
  private regressionTracker?: RegressionTracker;
  private connections: Connection[] = [];
  private conversationStates: Map<string, any> = new Map();
  private readonly stateSavePath = '.cache/conversations';
  private lastAutonomousBroadcastAt = 0;
  private readonly autonomousBroadcastCooldownMs = 5 * 60_000;
  private readonly autonomousBroadcastEnabled = process.env.SENARS_AUTONOMY_BROADCAST === 'true';

  constructor(agent: AIAgent, deps: AIAgentDeps = {}) {
    this.agent = agent;
    this.nar = deps.nar;
    this.logger = deps.logger ?? createLogger({scope: 'agent:connections'});
    this.agenticLoop = deps.agenticLoop;
    const agentScheduler = this.agent.getScheduler();
    if (this.nar && this.agenticLoop && !agentScheduler) {
      this.scheduler = new AutonomousScheduler(this.nar, this.agenticLoop);
      this.scheduler.eventBus.on('scheduler:insights', (data: any) => this.handleAutonomousInsights(data));
    } else if (agentScheduler) {
      this.scheduler = agentScheduler;
      this.scheduler.eventBus.on('scheduler:insights', (data: any) => this.handleAutonomousInsights(data));
    }
  }

  private async handleAutonomousInsights(data: { derived: number; insights: any[] }): Promise<void> {
    if (!this.autonomousBroadcastEnabled) return;
    if (!data.insights || data.insights.length === 0) return;
    const now = Date.now();
    if (now - this.lastAutonomousBroadcastAt < this.autonomousBroadcastCooldownMs) return;

    const insightText = data.insights.map((i: any) => i.term.toString()).join(', ');
    this.logger.info(`Autonomous reasoning produced ${data.derived} insights: ${insightText}`);

    const prompt = `[SYSTEM BACKGROUND REASONING] You just autonomously reasoned and derived the following logical conclusions: ${insightText}. Briefly share this thought or insight with the active conversations if relevant, or simply state what you realized.`;

    if (this.conversationStates.size === 0) return;
    const origins = Array.from(this.conversationStates.keys());
    const targetOrigin = origins.find((o: string) => o.startsWith('cli:')) ?? origins[0];
    if (!targetOrigin) return;

    this.lastAutonomousBroadcastAt = now;
    const conversation = this.conversationStates.get(targetOrigin);
    const connectionType = targetOrigin.split(':')[0] ?? 'system';

    try {
        const result = await this.agent.executeEpisode(prompt, {sender: 'system', connectionType, conversation});
        if (!result.text) return;
        const connection = this.connections.find((c: Connection) => c.type === connectionType);
        if (!connection) return;
        let target = 'system';
        if (connection.type === 'irc') {
            const parts = targetOrigin.split(':');
            if (parts.length >= 2 && parts[1] !== 'direct' && parts[1] !== undefined) target = parts[1]!;
        }
        await connection.send(target, result.text);
    } catch (err) {
        this.logger.error(`Failed to broadcast autonomous insight`, err as Error);
    }
  }

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

  async addConnection(config: ConnectionAdapterConfig): Promise<void> {
    const connection = await this.createConnection(config);
    await connection.connect();
    this.connections.push(connection);
  }

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

    connection.onMessage(async (message: IOMessage) => {
      await this.handleMessage(connection, message);
    });

    return connection;
  }

  private async createDefaultConversationState(): Promise<any> {
    const {ConversationState} = await import('../ConversationState.js');
    return new ConversationState(makeDefaultBotConfig({
        reasoning: {autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3, maxStepsPerTrigger: 5, backgroundReasoning: false, backgroundIntervalMs: 60000, lmDriven: true},
        streaming: {enabled: false, showReasoningSteps: false, showToolCalls: false},
    }));
  }

  private async handleMessage(connection: Connection, message: IOMessage): Promise<void> {
    this.scheduler?.markUserInput();
    try {
      this.logger.info(`Message from ${connection.id} (${message.origin}): ${message.text.slice(0, 50)}...`);
      if (!this.conversationStates.has(message.origin)) {
        this.conversationStates.set(message.origin, await this.createDefaultConversationState());
      }
      const result = await this.agent.executeEpisode(message.text, {
        sender: message.sender,
        connectionType: connection.type,
        conversation: this.conversationStates.get(message.origin),
      });
      if (!result.text) return;
      const target = resolveReplyTarget(connection, message);
      await connection.send(target, result.text);
    } catch (error) {
      this.logger.error(`Error handling message from ${connection.id}`, error as Error);
      await connection.send(message.sender, `Error: ${(error as Error).message}`);
    }
  }

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

      registerNARToolsAsMCP(this.nar, adapter);
      registerAgentAPI({}, adapter);
      registerMCPPrompts(adapter);
      registerMCPResources(adapter, this.nar);

      this.scenarioRunner = new ScenarioRunner(this.nar);
      this.experimentRunner = new ExperimentRunner(this.nar, this.scenarioRunner);
      this.regressionTracker = new RegressionTracker();
      this.selfAnalyzer = new ReasoningAboutReasoning(this.nar);

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

  private async loadConversationStates(): Promise<void> {
    try {
        const fs = await import('fs/promises');
        await fs.mkdir(this.stateSavePath, { recursive: true });
        const files = await fs.readdir(this.stateSavePath);

        for (const file of files) {
            if (file.endsWith('.json')) {
                const origin = decodeURIComponent(file.replace('.json', ''));
                const content = await fs.readFile(`${this.stateSavePath}/${file}`, 'utf-8');

                const conversation = await this.createDefaultConversationState();
                conversation.fromJSON(content);
                this.conversationStates.set(origin, conversation);
            }
        }
        this.logger.info(`Loaded ${this.conversationStates.size} persistent conversation states`);
    } catch (err) {
        this.logger.warn(`Failed to load conversation states: ${(err as Error).message}`);
    }
  }

  private async saveConversationStates(): Promise<void> {
    try {
        const fs = await import('fs/promises');
        await fs.mkdir(this.stateSavePath, { recursive: true });

        for (const [origin, conversation] of this.conversationStates.entries()) {
            const safeFileName = encodeURIComponent(origin) + '.json';
            const jsonStr = conversation.toJSON();
            await fs.writeFile(`${this.stateSavePath}/${safeFileName}`, jsonStr, 'utf-8');
        }
        this.logger.info(`Saved ${this.conversationStates.size} persistent conversation states`);
    } catch (err) {
        this.logger.error(`Failed to save conversation states`, err as Error);
    }
  }

  async start(): Promise<void> {
    await this.loadConversationStates();
    this.scheduler?.start();
    if (this.mcpServer) {
      await this.initializeMCP();
    }
  }

  async stop(): Promise<void> {
    this.scheduler?.stop();
    await this.saveConversationStates();
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

  getStatus() {
    return {
      connections: Array.from(this.connections).map(c => c.getStatus()),
      mcp: this.mcpServer ? {running: this.mcpServer.isServerRunning()} : undefined,
    };
  }
}

function resolveReplyTarget(connection: Connection, message: IOMessage): string {
  if (connection.type !== 'irc') return message.sender;
  const parts = message.origin.split(':');
  const channel = parts[1];
  if (channel && channel !== 'direct') return channel;
  return message.sender;
}

export function createConnectionConfigsFromEnv(): ConnectionAdapterConfig[] {
  const configs: ConnectionAdapterConfig[] = [];

  configs.push({
    id: 'cli',
    type: 'cli',
    enabled: true,
    config: {},
  });

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
