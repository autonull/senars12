import {MeTTaInterpreter} from '@senars/metta/src/MeTTaInterpreter.js';

export class MeTTaTestUtils {
    static createInterpreter(options = {}) {
        const opts = {...options};
        if (options.loadStdlib) {
            opts.loadStdlib = true;
        }
        return new MeTTaInterpreter(opts);
    }
}
