/**
 * Core commands: help, run, stats, list, config, clear, quit
 */
import type {NAR} from '../nar';

export function createCoreCommands(nar: NAR, display: any) {
    return {
        help: {
            name: '.help',
            description: 'Show help for commands',
            execute: () => display.showHelp()
        },
        run: {
            name: '.run',
            description: 'Run inference steps',
            execute: async (args: string[]) => {
                const steps = args[0] ? parseInt(args[0]) : 5;
                const derived = await nar.run(steps);
                console.log(`✓ Ran ${steps} step(s), derived ${derived} belief(s)`);
            }
        },
        stats: {
            name: '.stats',
            description: 'Show statistics',
            execute: (args: string[]) => display.showStats(nar, args[0])
        },
        list: {
            name: '.list',
            description: 'List concepts',
            execute: () => display.listConcepts(nar)
        },
        config: {
            name: '.config',
            description: 'View/set configuration',
            execute: (args: string[]) => {
                if (args.length === 0) {
                    const config = nar.getConfig();
                    console.log('\nCurrent Configuration:');
                    for (const [key, value] of Object.entries(config)) {
                        console.log(` ${key}: ${String(value)}`);
                    }
                    console.log();
                    return;
                }

                if (args.length === 1) {
                    const config = nar.getConfig();
                    const value = config[args[0] as keyof typeof config];
                    console.log(`${args[0]}: ${String(value ?? 'unknown')}`);
                    return;
                }

                if (args.length === 2) {
                    const [key, value] = args;
                    const typedValue = isNaN(Number(value)) ? value : Number(value);
                    nar.setConfig({[key!]: typedValue} as any);
                    console.log(`Set ${key} to ${typedValue}`);
                }
            }
        },
        clear: {
            name: '.clear',
            description: 'Clear memory',
            execute: () => {
                nar.clearMemory();
                console.log('✓ Memory cleared');
            }
        },
        quit: {
            name: '.quit',
            description: 'Exit',
            execute: () => {
                console.log('Goodbye!');
                process.exit(0);
            }
        }
    };
}
