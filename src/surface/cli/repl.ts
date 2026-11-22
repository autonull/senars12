/**
 * CLI REPL — interactive read-eval-print loop.
 */

import type { CLIApp, CLIContext, CLICommand } from './types';
import { parseArgs, executeCLI } from './entry';

/** REPL state. */
export interface REPLState {
  /** CLI app. */
  app: CLIApp;
  /** History. */
  history: string[];
  /** Current input buffer. */
  buffer: string;
  /** Running. */
  running: boolean;
  /** Custom prompt. */
  prompt: string;
}

/** Create REPL. */
export function createREPL(app: CLIApp, prompt = 'senars> '): REPLState {
  return {
    app,
    history: [],
    buffer: '',
    running: true,
    prompt,
  };
}

/** Run REPL loop. */
export async function runREPL(state: REPLState, readline: ReadlineInterface): Promise<void> {
  console.log(`Welcome to ${state.app.config.name} v${state.app.config.version}`);
  console.log('Type .help for commands, .exit to quit');
  console.log('');

  while (state.running) {
    try {
      const line = await readline.question(state.prompt);
      state.buffer = line.trim();

      if (!state.buffer) continue;

      // Handle REPL meta-commands
      if (state.buffer.startsWith('.')) {
        await handleMetaCommand(state, state.buffer);
        continue;
      }

      // Add to history
      state.history.push(state.buffer);

      // Parse and execute
      const args = state.buffer.split(/\s+/);
      const context = parseArgs(args, state.app);
      await executeCLI(state.app, context);
    } catch (error) {
      if (error instanceof Error && error.message === 'EOF') {
        break;
      }
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log('Goodbye!');
}

/** Handle meta-commands. */
async function handleMetaCommand(state: REPLState, command: string): Promise<void> {
  const parts = command.slice(1).split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      console.log('Meta-commands:');
      console.log('  .help     Show this help');
      console.log('  .exit     Exit REPL');
      console.log('  .history  Show command history');
      console.log('  .clear    Clear screen');
      console.log('  .commands List available commands');
      break;

    case 'exit':
    case 'quit':
      state.running = false;
      break;

    case 'history':
      for (let i = 0; i < state.history.length; i++) {
        console.log(`${i + 1}: ${state.history[i]}`);
      }
      break;

    case 'clear':
      console.clear();
      break;

    case 'commands': {
      const seen = new Set<string>();
      for (const [, command] of state.app.commands) {
        if (!seen.has(command.name)) {
          seen.add(command.name);
          console.log(`  ${command.name}  ${command.description}`);
        }
      }
      break;
    }

    default:
      console.log(`Unknown meta-command: .${cmd}`);
  }
}

/** Readline interface (abstract for testing). */
export interface ReadlineInterface {
  question(prompt: string): Promise<string>;
  close(): void;
}

/** Create readline interface. */
export async function createReadline(): Promise<ReadlineInterface> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    question: (prompt: string) => new Promise<string>((resolve) => {
      rl.question(prompt, resolve);
    }),
    close: () => rl.close(),
  };
}