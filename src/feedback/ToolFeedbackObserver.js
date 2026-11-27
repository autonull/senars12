import { selectTopN } from '@senars/util/collections';
import { CallTallySeries, createCallTally } from '@senars/util/tally';
export const toSkillFeedback = (fb) => ({
    skill: fb.name,
    lastResult: fb.lastResult,
    successRate: fb.successRate,
    callCount: fb.totalCalls,
    lastError: fb.lastError,
});
/** Tool names arrive out of model output, so the series is capacity-bounded. */
const MAX_TRACKED_TOOLS = 256;
export class DefaultToolFeedbackObserver {
    feedback = new CallTallySeries({
        maxSize: MAX_TRACKED_TOOLS,
        create: (name) => ({ ...createCallTally(), name, lastResult: '' }),
    });
    recordCall(name, result, duration) {
        const feedback = this.feedback.record(name, result.success, duration);
        feedback.lastResult = result.success ? String(result.content ?? '') : '';
        feedback.lastError = result.success ? undefined : (result.error ?? 'Unknown error');
    }
    getFeedback(name) {
        return this.feedback.get(name);
    }
    getAllFeedback() {
        return [...this.feedback.values()];
    }
    getFeedbackString(limit) {
        return selectTopN(this.feedback.values(), limit, (f) => f.totalCalls)
            .map((f) => `${f.name}: ${f.lastResult || f.lastError || 'no result'}`)
            .join('\n');
    }
    resetFeedback(name) {
        this.feedback.reset(name);
    }
}
