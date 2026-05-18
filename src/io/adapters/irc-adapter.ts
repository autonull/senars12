import type {Agent} from '../../agent/Agent.js';
import type {AgenticLoop} from '../../agent/AgenticLoop.js';
import type {BotProfile} from '../../agent/BotProfile.js';
import type {ChannelBehavior} from '../../agent/ChannelBehavior.js';
import type {ConversationManager} from '../../agent/ConversationManager.js';
import type {ResponseFormatter} from '../../agent/ResponseFormatter.js';
import type {IRCConnection} from '../connections/irc.js';
import type {IOMessage} from '../types.js';

export interface IRCAdapterConfig {
  botProfile: BotProfile;
  channelBehavior: ChannelBehavior;
  conversationManager: ConversationManager;
  responseFormatter: ResponseFormatter;
  agent: Agent;
  agenticLoop: AgenticLoop;
  ircConnection: IRCConnection;
  channels: string[];
}

/**
 * IRC Adapter - Wraps IRC connection with BOT2.md features:
 * - BotProfile: join messages, personality
 * - ChannelBehavior: per-channel policies
 * - ConversationManager: per-user context
 * - ResponseFormatter: 400-char chunking
 * - Address detection: PM vs channel mentions
 */
export class IRCAdapter {
  private readonly config: IRCAdapterConfig;
  private readonly botNick: string;
  private joinedChannels = new Set<string>();

  constructor(config: IRCAdapterConfig) {
    this.config = config;
    this.botNick = config.ircConnection.name || 'SeNARS';
    this.setupListeners();
  }

  private setupListeners(): void {
    const {ircConnection, agent, agenticLoop} = this.config;

    // Listen for incoming IRC messages
    ircConnection.onMessage(async (message: IOMessage) => {
      const shouldProcess = this.shouldProcessMessage(message);
      if (!shouldProcess) {
        return;
      }

      // Strip nick prefix if present
      const cleanText = this.stripNickPrefix(message.text);

      // Push to AgenticLoop for processing
      agenticLoop.pushMessage({
        ...message,
        text: cleanText
      });
    });

    // Handle channel join
    ircConnection.on('join', (channel: string) => {
      this.handleChannelJoin(channel);
    });
  }

  /**
   * Determine if message should be processed
   * - PM: always process
   * - Channel: only if addressed to bot
   */
  private shouldProcessMessage(message: IOMessage): boolean {
    const {channel} = message.metadata || {};
    
    // If it's a PM (no channel or channel is the bot itself)
    if (!channel || channel === this.botNick) {
      return true;
    }

    // Channel message - check if addressed to bot
    const text = message.text.trim();
    
    // Check for nick prefix: "SeNARS: hello" or "SeNARS, hello"
    const nickPrefixPattern = new RegExp(`^${this.botNick}[:,.]\\s*`, 'i');
    if (nickPrefixPattern.test(text)) {
      return true;
    }

    // Not addressed to bot
    return false;
  }

  /**
   * Strip nick prefix from message
   * "SeNARS: hello" -> "hello"
   */
  private stripNickPrefix(text: string): string {
    const nickPrefixPattern = new RegExp(`^${this.botNick}[:,.]\\s*`, 'i');
    return text.replace(nickPrefixPattern, '').trim();
  }

  /**
   * Handle channel join event
   */
  private async handleChannelJoin(channel: string): Promise<void> {
    if (this.joinedChannels.has(channel)) {
      return;
    }

    this.joinedChannels.add(channel);
    const {botProfile, ircConnection} = this.config;

    // Send join message from BotProfile
    if (botProfile.joinMessage) {
      await ircConnection.send(channel, botProfile.joinMessage);
    }
  }

  /**
   * Format and send response via IRC
   */
  async sendResponse(target: string, text: string): Promise<void> {
    const {responseFormatter, ircConnection} = this.config;

    // Format for IRC (400-char chunks)
    const chunks = responseFormatter.formatForIRC(text);

    // Send each chunk
    for (const chunk of chunks) {
      await ircConnection.send(target, chunk);
    }
  }

  /**
   * Get per-user conversation context
   */
  async getUserContext(userId: string): Promise<string | undefined> {
    const {conversationManager} = this.config;
    return conversationManager.getContext(userId);
  }

  /**
   * Add message to conversation history
   */
  async addUserMessage(userId: string, text: string): Promise<void> {
    const {conversationManager} = this.config;
    conversationManager.addMessage(userId, 'user', text);
  }

  /**
   * Add response to conversation history
   */
  async addResponseMessage(userId: string, text: string): Promise<void> {
    const {conversationManager} = this.config;
    conversationManager.addMessage(userId, 'assistant', text);
  }
}

/**
 * Factory function to create IRCAdapter
 */
export function createIRCAdapter(config: IRCAdapterConfig): IRCAdapter {
  return new IRCAdapter(config);
}
