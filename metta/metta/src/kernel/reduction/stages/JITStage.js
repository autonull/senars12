import {ReductionStage} from './ReductionStage.js';

export class JITStage extends ReductionStage {
    constructor(jitCompiler) {
        super('jit');
        this.compiler = jitCompiler;
    }

    process(atom, context) {
        if (!context.config?.get('jit')) {
            return null;
        }
        const jitFn = this.compiler.track(atom) ?? this.compiler.get(atom);
        if (!jitFn) {
            return null;
        }
        const result = jitFn(context.ground, context.space);
        return result && result !== atom ? {reduced: result, applied: true, stage: 'jit'} : null;
    }
}
