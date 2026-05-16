import kleur from 'kleur';
import Table from 'cli-table3';
import ora from 'ora';
import figures from 'figures';

const k = {
    sys: (s: string) => kleur.cyan(s),
    ok: (s: string) => kleur.green(`${figures.tick} ${s}`),
    err: (s: string) => kleur.red(`${figures.cross} ${s}`),
    warn: (s: string) => kleur.yellow(`${figures.warning} ${s}`),
    info: (s: string) => kleur.blue(`${figures.info} ${s}`),
    lm: (s: string) => kleur.magenta(`${figures.star} ${s}`),
    reason: (s: string) => kleur.yellow(`${figures.pointer} ${s}`),
    hint: (s: string) => kleur.gray(`  ${figures.arrowRight} ${s}`),
    prompt: (s: string) => kleur.bold().cyan(s),
    dim: (s: string) => kleur.gray(s),
    bold: (s: string) => kleur.bold(s),
};

const MIN_WIDTH = 50;

export function box(title: string, lines: string[]): string {
    const width = Math.max(title.length + 4, ...lines.map(l => l.length + 4), MIN_WIDTH);
    const horizontal = '═'.repeat(width - 2);
    const top = `╔${horizontal}╗`;
    const titleLine = `║ ${title.padEnd(width - 3)}║`;
    const middle = lines.length > 0 ? `╠${horizontal}╣` : `║ ${' '.repeat(width - 3)}║`;
    const content = lines.map(line => `║ ${line.padEnd(width - 3)}║`).join('\n');
    const bottom = `╚${horizontal}╝`;
    return `${top}\n${titleLine}\n${middle}\n${content ? content + '\n' : ''}${bottom}`;
}

export type SpinnerHandle = ReturnType<typeof ora>;

export class OutputRenderer {
    spinner(text: string): SpinnerHandle {
        return ora({text, color: 'cyan', spinner: 'dots'}).start();
    }

    success(msg: string) {
        console.log(`  ${k.ok(msg)}`);
    }

    error(msg: string) {
        console.log(`  ${k.err(msg)}`);
    }

    warn(msg: string) {
        console.log(`  ${k.warn(msg)}`);
    }

    info(msg: string) {
        console.log(`  ${k.info(msg)}`);
    }

    hint(msg: string) {
        console.log(k.hint(msg));
    }

    reasoning(msg: string) {
        console.log(`  ${k.reason(msg)}`);
    }

    lm(msg: string) {
        console.log(`  ${k.lm(msg)}`);
    }

    table(headers: string[], rows: string[][]) {
        const t = new Table({
            head: headers.map(h => k.bold(k.sys(h))),
            style: {head: [], border: ['gray']},
            chars: {mid: '·', 'left-mid': '·', 'mid-mid': '·', 'right-mid': '·'},
        });
        for (const row of rows) t.push(row.map(c => k.dim(c)));
        console.log(t.toString());
    }

    banner() {
        const title = kleur.bold().cyan('SeNARS') + kleur.gray(' Cognitive Synergy REPL');
        const subtitle = kleur.gray('NL ↔ Narsese ↔ Symbolic Reasoning ↔ LM');
        const line = kleur.gray('─'.repeat(56));
        console.log(`\n${line}\n  ${title}\n  ${subtitle}\n${line}\n`);
    }

    help() {
        const table = new Table({style: {border: ['gray']}});
        table.push(
            [k.bold('(term --> term).'), k.dim('Add Narsese belief')],
            [k.bold('(term)?'), k.dim('Ask Narsese question')],
            [k.bold('"natural language"'), k.lm('Natural language (LM-powered)')],
            [k.bold('.command'), k.dim('System command')],
        );
        console.log(table.toString());
    }

}

export {k};
