import type {Task, Term} from '../types';

export const findConflicts = (beliefs: Task[]): Array<{ a: Term; b: Term }> => {
    const byTerm = new Map<string, Array<{ term: Term; f: number }>>();
    for (const b of beliefs) {
        if (!b.truth) continue;
        const key = b.term.toString();
        const list = byTerm.get(key) ?? [];
        list.push({term: b.term as Term, f: b.truth.f});
        byTerm.set(key, list);
    }
    const conflicts: Array<{ a: Term; b: Term }> = [];
    for (const truths of byTerm.values()) {
        for (let i = 0; i < truths.length; i++) {
            for (let j = i + 1; j < truths.length; j++) {
                const a = truths[i]!;
                const b = truths[j]!;
                if (Math.abs(a.f - b.f) > 0.3) conflicts.push({a: a.term, b: b.term});
            }
        }
    }
    return conflicts;
};

export const countContradictions = (beliefs: Task[]): number => findConflicts(beliefs).length;

export const termOverlap = (a: string, b: string): number => {
    const aw = new Set(
        a
            .toLowerCase()
            .split(/[\s_()\[\]<>\-\/=>]+/)
            .filter(Boolean)
    );
    const bw = new Set(
        b
            .toLowerCase()
            .split(/[\s_()\[\]<>\-\/=>]+/)
            .filter(Boolean)
    );
    if (!aw.size || !bw.size) return 0;
    let n = 0;
    for (const w of aw) if (bw.has(w)) n++;
    return n / Math.max(aw.size, bw.size);
};
