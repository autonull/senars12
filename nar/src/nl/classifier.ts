export type InputType = 'command' | 'narsese-belief' | 'narsese-question' | 'nl-explicit' | 'nl-implicit';

export function classify(input: string): InputType {
    const t = input.trim();
    if (t.startsWith('.')) return 'command';
    if (/^".*"$/.test(t)) return 'nl-explicit';
    if (t.endsWith('?')) return 'narsese-question';
    if (t.endsWith('.')) return isLikelyNarsese(t) ? 'narsese-belief' : 'nl-implicit';
    return isLikelyNarsese(t) ? 'narsese-belief' : 'nl-implicit';
}

function isLikelyNarsese(t: string): boolean {
    const trimmed = t.replace(/\.$/, '').trim();
    return /^[\(\[<]/.test(trimmed) && /(-->|<->|=>|<=>|&|\|)/.test(trimmed);
}
