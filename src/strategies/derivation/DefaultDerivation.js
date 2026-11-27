import { createDerivedTask, toRuleInput } from '../../reason/inference-utils';
import { Strategy } from '../base';
export class DefaultDerivation extends Strategy {
    constructor(name = 'default', description = 'Iterate all secondaries, fire sync rules per pair, stage model-backed work') {
        super(name, description);
    }
    async *derive(primary, secondaries, processor, ctx) {
        const p1 = toRuleInput(primary);
        if (secondaries.length > 0) {
            for (const secondary of secondaries) {
                if (ctx.signal?.aborted)
                    return;
                const p2 = toRuleInput(secondary);
                for (const result of processor.processSync(p1, p2))
                    yield createDerivedTask(result);
                processor.stageModelRuleWork(p1, p2);
            }
        }
        else if (ctx.singlePremiseEnabled) {
            processor.stageModelRuleWork(p1);
        }
    }
}
