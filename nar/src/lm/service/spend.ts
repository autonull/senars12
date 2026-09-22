import type { LMTask } from '@senars/util';
import { recordLmSpend } from '../../metrics/index.js';
import { getModelCapability } from '../providers.js';
import { LMUnavailableError, withHint } from './errors.js';

/** H3/X15: per-provider cumulative spend. */
export interface ProviderSpend {
  tokensIn: number;
  tokensOut: number;
  calls: number;
  /** Cumulative cost in milli-dollars (MODEL_CAPABILITIES.costPerMTok × tokens). */
  costMilli: number;
}

const spendCapUsd = (): number | undefined => {
  const raw = process.env.LM_MAX_SPEND_USD;
  if (!raw) return undefined;
  const v = Number(raw);
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

/** H3: per-provider spend ledger (token totals from AI-SDK usage + capability table). */
export class SpendLedger {
  private spend = new Map<string, ProviderSpend>();

  snapshot(): Record<string, ProviderSpend> {
    return Object.fromEntries(this.spend);
  }

  /** Record usage tokens + capability-table cost against the provider; throws
   *  LMUnavailableError (with remediation) once LM_MAX_SPEND_USD is exceeded. */
  record(
    provider: string,
    task: LMTask,
    modelId: string | undefined,
    tokensIn: number,
    tokensOut: number
  ): void {
    const entry = this.spend.get(provider) ?? { tokensIn: 0, tokensOut: 0, calls: 0, costMilli: 0 };
    entry.tokensIn += tokensIn;
    entry.tokensOut += tokensOut;
    entry.calls += 1;
    const cap = getModelCapability(modelId ?? '')?.costPerMTok ?? 0;
    const costMilli = ((tokensIn + tokensOut) / 1_000_000) * cap * 1000;
    entry.costMilli += costMilli;
    this.spend.set(provider, entry);
    recordLmSpend(provider, tokensIn + tokensOut, costMilli);

    const capUsd = spendCapUsd();
    if (capUsd !== undefined && entry.costMilli / 1000 > capUsd) {
      throw new LMUnavailableError(
        withHint(
          `Spend cap reached for provider '${provider}': $${(entry.costMilli / 1000).toFixed(4)} >= LM_MAX_SPEND_USD=$${capUsd}. ` +
            `Raise LM_MAX_SPEND_USD, switch to a local provider (LM_PROVIDER=mock|transformers), or set LM_OFFLINE=1.`,
          provider
        ),
        provider,
        task
      );
    }
  }
}
