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
    const metrics = nar.getMetrics?.();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║ SeNARS Statistics                                     ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log(`║ Concepts: ${String(stats.totalConcepts).padEnd(48)}║`);
    console.log(`║ Tasks: ${String(stats.totalTasks).padEnd(49)}║`);

    if (detail === 'detail' || detail === 'all') {
        const ruleExecs = metrics?.rules?.reduce((sum, r) => sum + r.executions, 0) ?? 0;
        const derivs = metrics?.system?.totalDerivations ?? 0;
        const steps = metrics?.system?.totalSteps ?? 0;
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
    console.log(box('SeNARS CLI Commands', [
        '(term).            Add belief',
        '(term)?            Ask question',
        '{ ... }.           Multi-line input',
        '.run [n]           Run n inference steps',
        '.stats [detail]    Show statistics',
        '.concepts [f]      List concepts (filter)',
        '.rules             List registered rules',
        '.tools [f]         List available tools',
        '.query <term>      Query memory',
        '.trace <term>      Show derivation history',
        '.explain <term>    Explain why derived',
        '.config [k] [v]    View/set config',
        '.clear             Clear memory',
        '.load <file>       Load Narsese file',
        '.save <file>       Save memory to JSON',
        '.profile [cmd]     Performance profiling',
        '',
        'Self/Metacognition:',
        '.self              Show self status',
        '.meta              Show meta-analysis',
        '.optimize          Apply optimizations now',
        '',
        'RLFP:',
        '.prefer A B        Record A > B preference',
        '.reward            Show reward status',
        '.rlfp-stats        Show RLFP statistics',
        '',
        'LM:',
        '.lm-status         Show LM status',
        '.lm-switch <m>     Switch LM model',
        '',
        '.help [cmd]        Show help',
        '.quit              Exit',
    ]));
}

export function formatPaginatedList<T>(
    items: T[],
    max: number,
    format: (item: T) => string,
    options: { prefix?: string; suffix?: string } = {}
): string {
    const page = items.slice(0, max);
    const remaining = items.length - max;
    const lines = page.map(format);
    if (remaining > 0) lines.push(`... and ${remaining} more`);
    return (options.prefix ?? '') + lines.join('\n') + (options.suffix ?? '');
}