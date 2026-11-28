/**
 * Head training for System One.
 * Trains linear/logistic regression heads on (embedding, action) → target.
 */
import type { TrainingRow, TrainingOptions, HeadIdentity, TrainedHeadModel } from './types';
/**
 * Train a single judgment head.
 * Closed-form ridge for linear kind; batch GD with early stopping for logistic.
 */
export declare function trainHead(rows: readonly TrainingRow[], meta: HeadIdentity, options?: TrainingOptions): TrainedHeadModel;
//# sourceMappingURL=head-training.d.ts.map