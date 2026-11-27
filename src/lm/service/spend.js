import { accumulate, mapToRecord } from '@senars/util/collections';
import { envPositive } from '@senars/config';
import { recordLmSpend } from '../../metrics/index';
import { getModelCapability } from '../providers';
import { LMUnavailableError, withHint } from './errors';
const spendCapUsd = () => {
    const cap = envPositive('LM_MAX_SPEND_USD', 0);
    return cap > 0 ? cap : undefined;
};
/** H3: per-provider spend ledger (token totals from AI-SDK usage + capability table). */
export class SpendLedger {
    spend = new Map();
    snapshot() {
        return mapToRecord(this.spend);
    }
    /** Record usage tokens + capability-table cost against the provider; throws
     *  LMUnavailableError (with remediation) once LM_MAX_SPEND_USD is exceeded. */
    record(provider, task, modelId, tokensIn, tokensOut) {
        const cap = getModelCapability(modelId ?? '')?.costPerMTok ?? 0;
        const costMilli = ((tokensIn + tokensOut) / 1_000_000) * cap * 1000;
        const entry = accumulate(this.spend, provider, () => ({ tokensIn: 0, tokensOut: 0, calls: 0, costMilli: 0 }), (running) => {
            running.tokensIn += tokensIn;
            running.tokensOut += tokensOut;
            running.calls += 1;
            running.costMilli += costMilli;
        });
        recordLmSpend(provider, tokensIn + tokensOut, costMilli);
        const capUsd = spendCapUsd();
        const spentUsd = entry.costMilli / 1000;
        if (capUsd !== undefined && spentUsd > capUsd) {
            throw new LMUnavailableError(withHint(`Spend cap reached for provider '${provider}': $${spentUsd.toFixed(4)} >= LM_MAX_SPEND_USD=$${capUsd}. ` +
                `Raise LM_MAX_SPEND_USD, switch to a local provider (LM_PROVIDER=mock|transformers), or set LM_OFFLINE=1.`, provider), provider, task);
        }
    }
}
