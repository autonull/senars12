/**
 * CLI Entry — generated CLI over the same schemas as MCP.
 *
 * One binary serves CLI, HTTP, WS, IRC, MCP, browser and edge.
 */

import type { CLIConfig, CLICommand, CLIContext, CLIOption, CLIApp } from './types';

/** Create CLI app. */
export function createCLIApp(config: CLIConfig): CLIApp {
  return {
    config,
    commands: new Map(),
    globalOptions: [
      { name: 'help', alias: 'h', description: 'Show help', type: 'boolean' },
      { name: 'version', alias: 'v', description: 'Show version', type: 'boolean' },
      { name: 'config', alias: 'c', description: 'Config file path', type: 'string' },
      { name: 'verbose', alias: 'V', description: 'Verbose output', type: 'boolean' },
      { name: 'json', alias: 'j', description: 'Output as JSON', type: 'boolean' },
    ],
  };
}

/** Register command. */
export function registerCommand(app: CLIApp, command: CLICommand): void {
  app.commands.set(command.name, command);
  if (command.aliases) {
    for (const alias of command.aliases) {
      app.commands.set(alias, command);
    }
  }
}

/** Get command. */
export function getCommand(app: CLIApp, name: string): CLICommand | undefined {
  return app.commands.get(name);
}

/** Parse CLI arguments. */
export function parseArgs(args: string[], app: CLIApp): CLIContext {
  const context: CLIContext = {
    command: null,
    options: {},
    positional: [],
    raw: args,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const name = arg.slice(2);
      const option = app.globalOptions.find(o => o.name === name) ??
        (context.command ? context.command.options.find(o => o.name === name) : undefined);

      if (option?.type === 'boolean') {
        context.options[name] = true;
      } else if (i + 1 < args.length && !args[i + 1]!.startsWith('-')) {
        const value = args[++i]!;
        if (option?.type === 'number') {
          context.options[name] = parseFloat(value);
        } else if (option?.type === 'array') {
          context.options[name] = (context.options[name] as string[] ?? []).concat(value);
        } else {
          context.options[name] = value;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      // Short options
      for (const char of arg.slice(1)) {
        const option = app.globalOptions.find(o => o.alias === char) ??
          (context.command ? context.command.options.find(o => o.alias === char) : undefined);
        if (option?.type === 'boolean') {
          context.options[option.name] = true;
        }
      }
    } else if (!context.command) {
      // Command name
      const command = app.commands.get(arg);
      if (command) {
        context.command = command;
      } else {
        context.positional.push(arg);
      }
    } else {
      context.positional.push(arg);
    }
    i++;
  }

  // Apply defaults
  for (const option of app.globalOptions) {
    if (context.options[option.name] === undefined && option.default !== undefined) {
      context.options[option.name] = option.default;
    }
  }

  if (context.command) {
    for (const option of context.command.options) {
      if (context.options[option.name] === undefined && option.default !== undefined) {
        context.options[option.name] = option.default;
      }
    }
  }

  return context;
}

/** Execute CLI command. */
export async function executeCLI(app: CLIApp, context: CLIContext): Promise<number> {
  if (context.options.help) {
    printHelp(app, context.command?.name);
    return 0;
  }

  if (context.options.version) {
    console.log(`${app.config.name} v${app.config.version}`);
    return 0;
  }

  if (!context.command) {
    console.error('No command specified. Use --help for usage.');
    return 1;
  }

  try {
    await context.command.handler(context);
    return 0;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (context.options.verbose) {
      console.error(error);
    }
    return 1;
  }
}

/** Print help. */
function printHelp(app: CLIApp, commandName?: string): void {
  console.log(`${app.config.name} v${app.config.version}`);
  console.log(app.config.description);
  console.log('');
  console.log('Usage:');
  console.log(`  ${app.config.name} [global-options] <command> [command-options] [args...]`);
  console.log('');

  if (commandName) {
    const command = app.commands.get(commandName);
    if (command) {
      console.log(`Command: ${command.name}`);
      console.log(command.description);
      console.log('');
      console.log('Options:');
      for (const opt of command.options) {
        const alias = opt.alias ? `-${opt.alias}, ` : '';
        console.log(`  ${alias}--${opt.name}  ${opt.description}`);
      }
    }
  } else {
    console.log('Global options:');
    for (const opt of app.globalOptions) {
      const alias = opt.alias ? `-${opt.alias}, ` : '';
      console.log(`  ${alias}--${opt.name}  ${opt.description}`);
    }
    console.log('');
    console.log('Commands:');
    const seen = new Set<string>();
    for (const [name, cmd] of app.commands) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name);
        const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
        console.log(`  ${cmd.name}${aliases}  ${cmd.description}`);
      }
    }
  }
}

/** Generate CLI commands from MCP tools. */
export function generateCommandsFromTools(tools: Map<string, { name: string; description: string; inputSchema: { properties: Record<string, unknown>; required: string[] } }>): CLICommand[] {
  const commands: CLICommand[] = [];

  for (const [, tool] of tools) {
    const options = Object.entries(tool.inputSchema.properties).map(([name, schema]) => ({
      name,
      description: (schema as any).description ?? '',
      type: ((schema as any).type === 'number' ? 'number' :
            (schema as any).type === 'boolean' ? 'boolean' :
            (schema as any).type === 'array' ? 'array' : 'string') as CLIOption['type'],
      required: tool.inputSchema.required.includes(name),
    }));

    commands.push({
      name: tool.name.replace(/\./g, '-'),
      description: tool.description,
      options,
      handler: async (context) => {
        console.log(`Executing ${tool.name} with:`, context.options);
      },
    });
  }

  return commands;
}