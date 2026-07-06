/**
 * metta-worker.js - Node.js worker script for MeTTa evaluation
 */
import {parentPort} from 'worker_threads';
// Import path relative to this file: ../../../metta/src/MeTTaInterpreter.js -> ../../MeTTaInterpreter.js
import {MeTTaInterpreter} from '../../MeTTaInterpreter.js';

// Create persistent interpreter instance
const interpreter = new MeTTaInterpreter();

parentPort.on('message', (task) => {
    const {id, code} = task;
    try {
        // Run code
        const results = interpreter.run(code);

        // Serialize results to string as Atoms are not clonable across threads
        const resultStr = results.map(r => r.toString()).join(' ');

        parentPort.postMessage({id, result: resultStr});
    } catch (e) {
        parentPort.postMessage({id, error: e.message});
    }
});
