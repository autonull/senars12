import type {Memory} from './memory';
import type {NAR} from './nar';

export enum SourceQuality {
    PRIMARY = 0.9,
    SECONDARY = 0.7,
    GENERAL = 0.55,
    TERTIARY = 0.4,
    LLM_PRIOR = 0.5,
}

export class GroundingPipeline {
    private readonly nar: NAR;
    private readonly memory: Memory;
    private readonly tools: unknown;

    constructor(nar: NAR, memory: Memory, _tools: unknown) {
        this.nar = nar;
        this.memory = memory;
        this.tools = _tools;
    }

    async groundFact(
        _query: string,
        _source: string,
        quality: SourceQuality,
        fact: string
    ): Promise<void> {
        await this.nar.believe(fact, {f: 0.9, c: quality} as any);
    }

    recallGroundedFact(_query: string): string | null {
        return null;
    }

    getSourceConfidence(source: string): SourceQuality {
        const upper = source.toUpperCase();
        if (upper.includes('SEC') || upper.includes('PUBMED') || upper.includes('OFFICIAL')) {
            return SourceQuality.PRIMARY;
        }
        if (upper.includes('REUTERS') || upper.includes('AP') || upper.includes('MAJOR')) {
            return SourceQuality.SECONDARY;
        }
        if (upper.includes('WIKIPEDIA') || upper.includes('NEWS')) {
            return SourceQuality.GENERAL;
        }
        if (upper.includes('BLOG') || upper.includes('FORUM')) {
            return SourceQuality.TERTIARY;
        }
        return SourceQuality.LLM_PRIOR;
    }
}
