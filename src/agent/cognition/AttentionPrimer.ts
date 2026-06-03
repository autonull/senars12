import type {NAR} from '../../nar/nar.js';
import {extractTerms} from '../request/TermExtractor.js';

export class AttentionPrimer {
    constructor(private readonly nar?: NAR) {}

    prime(input: string): void {
        if (!this.nar) return;
        const {parsed} = extractTerms(input, this.nar);
        for (const termStr of parsed) {
            const concept = this.nar.listConcepts().find(c => c.term.toString() === termStr);
            if (concept) concept.priority = Math.min(1.0, concept.priority + 0.1);
        }
    }
}
