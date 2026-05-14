/**
 * Display utilities for CLI box-drawing and formatting
 */
import type {NAR} from '../nar';

export function box(title: string, lines: string[]): string {
    const width = Math.max(title.length + 4, ...lines.map(l => l.length + 4), 50);
    const horizontal = '═'.repeat(width - 2);

    const top = `╔${horizontal}╗`;
    const titleLine = `║ ${title.padEnd(width - 3)}║`;
    const middle = lines.length > 0 ? `╠${horizontal}╣` : `║ ${' '.repeat(width - 3)}║`;
    const content = lines.map(line => `║ ${line.padEnd(width - 3)}║`).join('\n');
    const bottom = `╚${horizontal}╝`;

    return `${top}\n${titleLine}\n${middle}\n${content ? content + '\n' : ''}${bottom}`;
}

export function showStats(nar: NAR, detail?: string): void {
    const stats = nar.getStatistics();
    const metrics = nar.getMetrics?.() || {};

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║ SeNARS Statistics                                     ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║ Concepts: ${String(stats.totalConcepts).padEnd(48)}║`);
    console.log(`║ Tasks: ${String(stats.totalTasks).padEnd(49)}║`);

    if (detail === 'detail' || detail === 'all') {
        const ruleExecs = (metrics as any).ruleExecutions?.total || 0;
        const derivs = (metrics as any).derivations || 0;
        const steps = (metrics as any).steps || 0;
        console.log(`║ Rule Executions: ${String(ruleExecs).padEnd(41)}║`);
        console.log(`║ Derivations: ${String(derivs).padEnd(45)}║`);
        console.log(`║ Steps: ${String(steps).padEnd(51)}║`);
    }

    console.log('╚════════════════════════════════════════════════════════╝\n');
}

export function listConcepts(nar: NAR): void {
    const concepts = nar.listConcepts();
    if (concepts.length === 0) {
        console.log('Memory is empty');
        return;
    }

    console.log('\nConcepts:');
    for (const concept of concepts.slice(0, 20)) {
        console.log(` - ${concept.term.toString()}`);
    }
    if (concepts.length > 20) {
        console.log(` ... and ${concepts.length - 20} more`);
    }
    console.log();
}

export function showHelp(): void {
    console.log(`
  ╔══════════════════════════════════════════════════╗
  ║ SeNARS CLI Commands                              ║
  ╠══════════════════════════════════════════════════╣
  ║ (term).            Add belief                    ║
  ║ (term)?            Ask question                  ║
  ║ { ... }.           Multi-line input              ║
  ║ .run [n]           Run n inference steps         ║
  ║ .stats [detail]    Show statistics               ║
  ║ .concepts [f]      List concepts (filter)        ║
  ║ .rules             List registered rules         ║
  ║ .tools [f]         List available tools          ║
  ║ .query <term>      Query memory                  ║
  ║ .trace <term>      Show derivation history       ║
  ║ .explain <term>    Explain why derived           ║
  ║ .config [k] [v]    View/set config               ║
  ║ .clear             Clear memory                  ║
  ║ .load <file>       Load Narsese file             ║
  ║ .save <file>       Save memory to JSON           ║
  ║ .profile [cmd]     Performance profiling         ║
  ╠══════════════════════════════════════════════════╣
  ║ Self/Metacognition:                              ║
  ║ .self              Show self status              ║
  ║ .meta              Show meta-analysis            ║
  ║ .optimize          Apply optimizations now       ║
  ╠══════════════════════════════════════════════════╣
  ║ RLFP:                                            ║
  ║ .prefer A B        Record A > B preference       ║
  ║ .reward            Show reward status            ║
  ║ .rlfp-stats        Show RLFP statistics          ║
  ╠══════════════════════════════════════════════════╣
  ║ LM:                                              ║
  ║ .lm-status         Show LM status                ║
  ║ .lm-switch <m>     Switch LM model               ║
  ╠══════════════════════════════════════════════════╣
  ║ .help [cmd]        Show help                     ║
  ║ .quit              Exit                          ║
  ╚══════════════════════════════════════════════════╝
`);
}

const COMMAND_HELP: Record<string, string> = {
    '.run': 'Usage: .run [n]\n  Run n inference cycles (default: 5)',
    '.stats': 'Usage: .stats [detail]\n  Show system statistics. Use "detail" for verbose output.',
    '.concepts': 'Usage: .concepts [filter]\n  List concepts in memory, optionally filtered by term',
    '.rules': 'Usage: .rules\n  Display registered inference rules',
    '.tools': 'Usage: .tools [filter]\n  List available tools, optionally filtered by name',
    '.query': 'Usage: .query <term>\n  Query memory for beliefs, goals, questions matching term',
    '.trace': 'Usage: .trace <term>\n  Show derivation trace for a term',
    '.explain': 'Usage: .explain <term>\n  Explain how a belief was derived',
    '.config': 'Usage: .config [key] [value]\n  View all config, or get/set specific values',
    '.clear': 'Usage: .clear\n  Clear all concepts and tasks from memory',
    '.load': 'Usage: .load <file>\n  Load Narsese beliefs from a file',
    '.save': 'Usage: .save <file>\n  Save current memory state to JSON file',
    '.profile': 'Usage: .profile [start|stop]\n  Start or stop performance profiling',
    '.self': 'Usage: .self\n  Show self-model and metacognition status',
    '.meta': 'Usage: .meta\n  Show meta-analysis report',
    '.optimize': 'Usage: .optimize\n  Apply metacognitive optimizations',
    '.prefer': 'Usage: .prefer <preferred> <rejected>\n  Record a preference: preferred > rejected',
    '.reward': 'Usage: .reward\n  Show RLFP reward and preference status',
    '.rlfp-stats': 'Usage: .rlfp-stats\n  Show detailed RLFP statistics',
    '.lm-status': 'Usage: .lm-status\n  Show language model provider status',
    '.lm-switch': 'Usage: .lm-switch <model>\n  Switch to a different LM model',
    '.ask-nl': 'Usage: .ask-nl <question>\n  Ask a natural language question',
    '.constitution': 'Usage: .constitution [add <belief>]\n  View or add immutable constitutional beliefs',
    '.attention': 'Usage: .attention\n  Show attention allocation report',
    '.load-domain': 'Usage: .load-domain <domain>\n  Load sample beliefs from a domain (biology, physics, math, programming, finance)',
    '.quit': 'Usage: .quit\n  Exit the REPL',
};

export function showCommandHelp(cmd: string): boolean {
    const help = COMMAND_HELP[cmd];
    if (help) {
        console.log(`\n${help}\n`);
        return true;
    }
    return false;
}
