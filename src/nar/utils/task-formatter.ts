import type {Task} from '../types/core.js';
import type {Truth} from '../terms/truth.js';

export interface TruthOpts {
    precision?: number;
    separator?: string;
}

export interface FormatOpts extends TruthOpts {
    includePunctuation?: boolean;
    includeBudget?: boolean;
}

const punctForType = (type: Task['type']): string =>
    type === 'goal' ? '!' : type === 'question' ? '?' : '.';

export const TaskFormatter = {
    punct(task: Task): string {
        return punctForType(task.type);
    },

    formatTruth(truth: Truth, opts?: TruthOpts): string {
        const p = opts?.precision ?? 2;
        const sep = opts?.separator ?? ':';
        return `${truth.f.toFixed(p)}${sep}${truth.c.toFixed(p)}`;
    },

    format(task: Task, opts?: FormatOpts): string {
        const termStr = task.term.toString();
        const punct = opts?.includePunctuation !== false ? punctForType(task.type) : '';
        const truthStr = task.truth ? ` :${this.formatTruth(task.truth, opts)}` : '';
        const budgetStr = opts?.includeBudget ? ` {p:${task.budget.priority.toFixed(2)}}` : '';
        return `${termStr}${punct}${truthStr}${budgetStr}`;
    },

    formatBrief(task: Task): string {
        return this.format(task, {includePunctuation: true, precision: 2});
    },

    formatFull(task: Task): string {
        return this.format(task, {includePunctuation: true, includeBudget: true, precision: 2});
    },

    formatTruthBrief(truth: Truth): string {
        return this.formatTruth(truth, {precision: 1});
    },
};
