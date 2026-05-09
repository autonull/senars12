/**
 * IRC Bot Embodiment
 * Connects SeNARS to IRC channels for real-time interaction
 */

import {Agent, Embodiment} from './Agent';
import irc from 'irc';

interface IRCConfig {
    server: string;
    port: number;
    nick: string;
    channels: string[];
    password?: string;
    userName?: string;
    realName?: string;
}

interface IRCBot {
    conn: irc.Client;
    channels: Set<string>;
    messageQueue: Array<{ channel: string; message: string; timestamp: number }>;
    lastMessageTime: number;
}

export class IRCBotEmbodiment implements Embodiment {
    readonly name = 'irc';
    private agent: Agent | null = null;
    private readonly configs: IRCConfig[] = [];
    private bots: Map<string, IRCBot> = new Map();
    private running = false;
    private rateLimitMs = 1000;
    private personalities: Map<string, string> = new Map();

    constructor(configs: IRCConfig[] = []) {
        this.configs = configs;
    }

    async start(agent: Agent): Promise<void> {
        this.agent = agent;
        this.running = true;

        for (const config of this.configs) {
            await this.connectToServer(config);
        }
    }

    async stop(): Promise<void> {
        this.running = false;

        const promises: Promise<void>[] = [];

        for (const [, bot] of this.bots) {
            for (const channel of bot.channels) {
                promises.push(new Promise(resolve => {
                    bot.conn.part(channel, '', () => resolve());
                }));
            }
            promises.push(new Promise(resolve => {
                bot.conn.disconnect('', () => resolve());
            }));
        }

        await Promise.all(promises);
        this.bots.clear();
    }

    async send(message: string): Promise<void> {
        // Broadcast to all channels
        for (const [, bot] of this.bots) {
            for (const channel of bot.channels) {
                bot.conn.say(channel, message);
            }
        }
    }

    onMessage(_handler: (message: string) => void): void {
        // Messages are handled through the agent
    }

    setPersonality(server: string, personality: string): void {
        this.personalities.set(server, personality);
    }

    getPersonality(server: string): string | undefined {
        return this.personalities.get(server);
    }

    joinChannel(server: string, port: number, channel: string): void {
        const serverKey = `${server}:${port}`;
        const bot = this.bots.get(serverKey);
        if (bot && !bot.channels.has(channel)) {
            bot.conn.join(channel);
        }
    }

    partChannel(server: string, port: number, channel: string): void {
        const serverKey = `${server}:${port}`;
        const bot = this.bots.get(serverKey);
        if (bot && bot.channels.has(channel)) {
            bot.conn.part(channel, '', () => {
            });
        }
    }

    getConnectedServers(): string[] {
        return Array.from(this.bots.keys());
    }

    getChannels(): string[] {
        const allChannels: string[] = [];
        for (const [, bot] of this.bots) {
            allChannels.push(...Array.from(bot.channels));
        }
        return allChannels;
    }

    private async connectToServer(config: IRCConfig): Promise<void> {
        if (!this.agent) return;

        const bot: IRCBot = {
            conn: new irc.Client(config.server, config.nick, {
                port: config.port,
                userName: config.userName || 'senars',
                realName: config.realName || 'SeNARS AI Bot',
                password: config.password,
                floodProtection: true,
                floodProtectionDelay: this.rateLimitMs
            }),
            channels: new Set(),
            messageQueue: [],
            lastMessageTime: 0
        };

        bot.conn.on('message', (from, to, message) => {
            this.handleMessage(bot, from, to, message);
        });

        bot.conn.on('join', (channel, who) => {
            if (who === config.nick) {
                bot.channels.add(channel);
                console.log(`Joined ${channel}`);
            }
        });

        bot.conn.on('part', (channel, who) => {
            if (who === config.nick) {
                bot.channels.delete(channel);
            }
        });

        bot.conn.on('error', (error) => {
            console.error('IRC error:', error);
        });

        const serverKey = `${config.server}:${config.port}`;
        this.bots.set(serverKey, bot);

        await new Promise<void>((resolve) => {
            bot.conn.once('registered', () => {
                for (const channel of config.channels) {
                    bot.conn.join(channel);
                }
                resolve();
            });
        });

        console.log(`Connected to ${serverKey} as ${config.nick}`);
    }

    private async handleMessage(bot: IRCBot, from: string, to: string, message: string): Promise<void> {
        if (!this.agent) return;

        const channel = to.startsWith('#') ? to : from;
        const isDirect = to.startsWith('#') === false;
        const isCommand = message.startsWith('.');
        const botNick = (bot.conn.opt as any)?.nick || 'bot';
        const isMentioned = message.includes(botNick);

        if (isDirect || isMentioned || isCommand) {
            const cleanMessage = isMentioned
                ? message.replace(new RegExp(`${botNick}[:\\s]+`, 'gi'), '').trim()
                : message;

            try {
                const response = await this.agent.handleInput(cleanMessage);
                if (response) {
                    await this.sendMessage(bot, channel, response);
                }
            } catch (error) {
                await this.sendMessage(bot, channel, `Error: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    private async sendMessage(bot: IRCBot, channel: string, message: string): Promise<void> {
        const now = Date.now();
        const delay = Math.max(0, this.rateLimitMs - (now - bot.lastMessageTime));

        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        bot.lastMessageTime = Date.now();
        bot.conn.say(channel, message);
    }
}
