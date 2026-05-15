/**
 * SeNARS CLI REPL - Interactive terminal interface for neuro-symbolic reasoning
 * Modernized with AI SDK provider registry, NL translator, and display pipeline
 */

import {SeNARSFactory} from '../nar';
import {createInterface} from 'readline';
import {HistoryManager} from './history';
import {CommandHandlers} from './command-handlers';
import {createSeNARSRegistry, getQualityModel} from '../nar/lm/providers.js';
import {NLTranslator} from '../nar/nl/translator.js';
import {InputPipeline} from './pipeline.js';
import {OutputRenderer} from './display.js';
import {k} from './display.js';

interface CLIConfig {
	maxConcepts: number;
	maxDerivationDepth: number;
	showDerivations: boolean;
}

type NARRef = ReturnType<typeof SeNARSFactory.createForCLI>;

const COMMANDS = [
	'.help', '.run', '.stats', '.list', '.concepts', '.rules', '.tools',
	'.query', '.trace', '.explain', '.clear', '.load', '.save',
	'.config', '.profile', '.quit', '.self', '.meta', '.optimize',
	'.prefer', '.reward', '.rlfp-stats', '.lm-status', '.lm-config', '.lm-switch',
	'.lm-switch-provider', '.ask-nl', '.constitution', '.attention', '.load-domain'
];

export class SeNARSCLI {
	private readonly nar: NARRef;
	private readonly rl: ReturnType<typeof createInterface>;
	private readonly history = new HistoryManager();
	private commands!: CommandHandlers;
	private pipeline!: InputPipeline;
	private readonly renderer: OutputRenderer;
	private translator?: NLTranslator;
	private multiLineBuffer: string[] = [];
	private inMultiLine = false;

	constructor(config: Partial<CLIConfig> = {}) {
		this.renderer = new OutputRenderer();

		const registry = createSeNARSRegistry();
		this.translator = new NLTranslator(registry);

		this.nar = SeNARSFactory.createDefault({
			core: {
				maxConcepts: config.maxConcepts ?? 100,
				maxDerivationDepth: config.maxDerivationDepth ?? 10
			},
			enableLMRules: true,
			providerRegistry: registry,
		}) as NARRef;

		this.commands = new CommandHandlers(this.nar);
		this.pipeline = new InputPipeline(this.nar, this.translator, this.renderer, this.commands);

		const isTTY = process.stdin.isTTY;

		this.rl = createInterface({
			input: process.stdin,
			output: process.stdout,
			prompt: k.prompt('senars> '),
			completer: (line: string): [string[], string] => this.completer(line),
			terminal: isTTY
		});

		process.on('SIGINT', () => {
			console.log(`\n${k.dim('Goodbye!')}`);
			this.rl.close();
		});

		this.rl.on('line', (line) => this.onLine(line));
		this.rl.on('close', () => {
			this.history.saveHistory();
			if (process.stdin.isTTY) {
				console.log(`\n${k.dim('Goodbye!')}`);
			}
			process.exit(0);
		});
	}

	async start(): Promise<void> {
		this.renderer.banner();

		const model = getQualityModel(createSeNARSRegistry());
		if (model) {
			this.renderer.success('Language model ready');
		} else {
			this.renderer.warn('No LM available — running in pure symbolic mode');
		}

		this.renderer.help();
		this.rl.prompt();
	}

	private async onLine(line: string): Promise<void> {
		if (this.inMultiLine) {
			if (line.trim() === '.') {
				const input = this.multiLineBuffer.join('\n');
				this.multiLineBuffer = [];
				this.inMultiLine = false;
				this.history.add(input);
				await this.pipeline.process(input);
			} else {
				this.multiLineBuffer.push(line);
			}
		} else {
			const trimmed = line.trim();
			if (!trimmed) {
				this.rl.prompt();
				return;
			}
			if (trimmed.startsWith('{')) {
				this.inMultiLine = true;
				this.multiLineBuffer = [trimmed.slice(1)];
				console.log(k.dim('> Multi-line input started (end with "." on empty line)'));
			} else {
				this.history.add(trimmed);
				await this.pipeline.process(trimmed);
			}
		}
		this.rl.prompt();
	}

	private completer(line: string): [string[], string] {
		const parts = line.split(/\s+/);
		const lastPart = parts[parts.length - 1] || '';

		if (line.startsWith('.')) {
			const matches = COMMANDS.filter(cmd => cmd.startsWith(lastPart));
			return [matches.length ? matches : [line], lastPart];
		}

		const concepts = this.nar.listConcepts().slice(0, 50);
		const matches = concepts.map(c => c.term.toString()).filter(term => term.startsWith(lastPart));
		return [matches.length ? matches : [line], lastPart];
	}
}

async function main() {
	const cli = new SeNARSCLI();
	await cli.start();
}

main();
