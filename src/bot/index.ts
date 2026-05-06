import { NAR } from '../nar/nar.js';
import { EmbeddedIRCServer } from './EmbeddedIRCServer.js';
import type { BotConfig } from './config.js';

export interface Bot {
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  status: any;
}

export async function createBot(config: BotConfig): Promise<Bot> {
  const nar = new NAR({
    maxConcepts: 1000,
    priorityThreshold: 0.5,
    activationDecayRate: 0.01,
    consolidationInterval: 10,
    cpuThrottleMs: 10,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 1000,
    enableLMRules: false
  });

  const ircCfg = config.embodiments?.irc;
  let ircServer: EmbeddedIRCServer | undefined;

  if (ircCfg?.enabled) {
    ircServer = new EmbeddedIRCServer({ port: ircCfg.port ?? 6667, hostname: '127.0.0.1', channel: ircCfg.channel });
    ircServer.on('message', ({ message }) => {
      if (message.command === 'PRIVMSG') {
        const text = message.params.slice(message.params[0]?.startsWith('#') ? 1 : 0).join(' ');
        if (text.includes('http://') || text.includes('https://')) {
          return;
        }
        nar.believe(text);
        ircServer?.send(message.params[0] || '#test', `Echo: ${text}`);
      }
    });
    await ircServer.start();
  }

  return {
    start: async () => {
      console.log('[Bot] Starting SeNARS Bot...');
      if (ircServer) {
        console.log('[Bot] Ready - IRC server active');
      } else {
        console.log('[Bot] Ready - minimal mode');
      }
      await nar.run(1);
    },
    shutdown: async () => {
      console.log('[Bot] Shutting down...');
      await ircServer?.stop();
    },
    status: {
      running: true,
      embodiments: {
        irc: ircCfg?.enabled ?? false,
        cli: config.embodiments?.cli?.enabled ?? false,
      },
    },
  };
}
