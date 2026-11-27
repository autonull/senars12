import { createConfig } from '../core/config';
import { InMemorySpace } from '../core/space';
import { MeTTaInterpreter } from '../engine/interpreter';
import { bootstrapStdLib } from '../stdlib/index';
import { DEFAULT_MEMORY_LIMIT } from './context';
import { BaseBuilder } from '@senars/util/builder';
export class MeTTaBuilder extends BaseBuilder {
    config;
    interpreter;
    constructor() {
        super();
        this.config = createConfig();
        this.interpreter = new MeTTaInterpreter();
        bootstrapStdLib();
        this.interpreter.addSpace(new InMemorySpace('default'));
    }
    /** Helper: set field and record step. */
    setAndRecord(field, value, stepName, present = true, detail) {
        this[field] = value;
        return this.recordStep(stepName, present, detail);
    }
    withConfig(overrides) {
        return this.setAndRecord('config', createConfig(overrides), 'withConfig');
    }
    withSpace(id) {
        this.interpreter.addSpace(new InMemorySpace(id));
        return this.recordStep('withSpace', true, { spaceId: id });
    }
    build() {
        return new MeTTaRuntime(this.interpreter, this.config);
    }
}
export class MeTTaRuntime {
    interpreter;
    config;
    constructor(interpreter, config) {
        this.interpreter = interpreter;
        this.config = config;
    }
    evaluate(program, ctx) {
        const context = {
            maxSteps: ctx?.maxSteps ?? this.config.maxSteps,
            timeout: ctx?.timeout ?? this.config.timeout,
            memoryLimit: ctx?.memoryLimit ?? DEFAULT_MEMORY_LIMIT,
        };
        return this.interpreter.evaluate(program, 'default', context);
    }
}
export function createMeTTa(config) {
    return new MeTTaBuilder().withConfig(config ?? {}).build();
}
