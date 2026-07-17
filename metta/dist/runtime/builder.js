import { createConfig } from '../core/config.js';
import { InMemorySpace } from '../core/space.js';
import { MeTTaInterpreter } from '../engine/interpreter.js';
import { bootstrapStdLib } from '../stdlib/index.js';
export class MeTTaBuilder {
    config;
    interpreter;
    constructor() {
        this.config = createConfig();
        this.interpreter = new MeTTaInterpreter();
        bootstrapStdLib();
        this.interpreter.addSpace(new InMemorySpace('default'));
    }
    withConfig(overrides) {
        this.config = createConfig(overrides);
        return this;
    }
    withSpace(id) {
        this.interpreter.addSpace(new InMemorySpace(id));
        return this;
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
            memoryLimit: ctx?.memoryLimit ?? 1024 * 1024,
        };
        return this.interpreter.evaluate(program, 'default');
    }
}
export function createMeTTa(config) {
    return new MeTTaBuilder().withConfig(config ?? {}).build();
}
//# sourceMappingURL=builder.js.map