export class ReductionStage {
    constructor(name) {
        this.name = name;
        this.enabled = true;
    }

    execute(atom, context) {
        if (!this.enabled) {
            return null;
        }
        return this.process(atom, context);
    }

    process(atom, context) {
        throw new Error('Subclasses must implement process()');
    }
}
