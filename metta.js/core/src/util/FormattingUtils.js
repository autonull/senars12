const PUNCTUATION_MAP = {'BELIEF': '.', 'GOAL': '!', 'QUESTION': '?'};
const DEFAULT_TRUTH = ' %1.000,0.900%';
const DEFAULT_PRIORITY = '';
const DEFAULT_TERM = 'Unknown';
const DEFAULT_TASK_TYPE = 'TASK';
const ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export class FormattingUtils {
    static formatTask(task) {
        const priority = this.formatPriority(task.budget?.priority);
        const term = task.term?.toString?.() ?? task.term ?? DEFAULT_TERM;
        const punctuation = this.getTypePunctuation(task.type ?? DEFAULT_TASK_TYPE);
        const truthStr = this.formatTruth(task.truth);
        const occurrence = this.formatOccurrence(task);

        return `${priority}${term}${punctuation}${truthStr}${occurrence}`;
    }

    static formatPriority(priority) {
        return priority !== undefined ? `$${priority.toFixed(3)} ` : '';
    }

    static formatTruth(truth) {
        if (!truth) {
            return DEFAULT_TRUTH;
        }

        const freq = truth.frequency?.toFixed(3) ?? '1.000';
        const conf = truth.confidence?.toFixed(3) ?? '0.900';
        return ` %${freq},${conf}%`;
    }

    static formatOccurrence(task) {
        if (task.occurrenceTime === undefined && !task.stamp) {
            return DEFAULT_PRIORITY;
        } // Return empty string

        const timeStr = task.occurrenceTime ?? '';
        const stampStr = task.stamp ? this.encodeShortId(task.stamp.id ?? task.stamp) : '';

        return stampStr ? ` ${timeStr}@${stampStr}`.trim() : timeStr;
    }

    static getTypePunctuation(type) {
        return PUNCTUATION_MAP[type?.toUpperCase()] ?? '.';
    }

    static formatConcept(concept) {
        if (!concept) {
            return 'undefined concept';
        }
        return concept.term ? concept.term.toString() : concept.toString();
    }

    static formatTaskDetails(task) {
        return [
            this.formatType(task.type),
            this.formatTruthStr(task.truth),
            this.formatPriorityStr(task.priority),
            this.formatStamp(task.stamp),
            this.formatOccurrenceTime(task.occurrenceTime)
        ].filter(Boolean).join(' | ');
    }

    static formatType(type) {
        return type ? `Type: ${type}` : 'Type: Task';
    }

    static formatTruthStr(truth) {
        return truth ? `Truth: ${truth.toString()}` : 'Truth: N/A';
    }

    static formatPriorityStr(priority) {
        return priority !== undefined ? `Priority: ${priority.toFixed(3)}` : 'Priority: N/A';
    }

    static formatStamp(stamp) {
        return stamp ? `Stamp: ${stamp}` : 'Stamp: N/A';
    }

    static formatOccurrenceTime(occurrenceTime) {
        return occurrenceTime !== undefined ? `OccTime: ${occurrenceTime}` : null;
    }

    static formatBeliefDetails(task) {
        return [
            this.formatBeliefTruth(task.truth),
            this.formatBeliefPriority(task.priority),
            this.formatBeliefOccurrence(task.stamp)
        ].filter(Boolean).join('');
    }

    static formatBeliefTruth(truth) {
        return truth ? `${truth.toString()}` : null;
    }

    static formatBeliefPriority(priority) {
        return priority !== undefined ? ` | P:${priority.toFixed(3)}` : null;
    }

    static formatBeliefOccurrence(stamp) {
        return stamp ? ` | Occ:${stamp}` : null;
    }

    static encodeShortId(input) {
        if (!input) {
            return 'N/A';
        }
        const inputStr = String(input);
        let hash = Array.from(inputStr).reduce((acc, char) => {
            const newHash = ((acc << 5) - acc) + char.charCodeAt(0);
            return newHash | 0;
        }, 0);
        hash = Math.abs(hash);
        if (hash === 0) {
            return ID_CHARS[0];
        }
        let result = '';
        const base = ID_CHARS.length;
        let num = hash;
        while (num > 0) {
            result = ID_CHARS[num % base] + result;
            num = Math.floor(num / base);
        }
        return result.length > 8 ? result.substring(0, 8) : result;
    }
}