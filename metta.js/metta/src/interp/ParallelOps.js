/**
 * ParallelOps.js - Parallel evaluation operations
 */

import {Term} from '../kernel/Term.js';
import {Unify} from '../kernel/Unify.js';
import {WorkerPool} from '../platform/WorkerPool.js';
import {ENV} from '../platform/env.js';

export function registerParallelOps(interpreter) {
    const {sym, exp} = Term;
    const reg = (n, fn, opts) => interpreter.ground.register(n, fn, opts);

    reg('&map-parallel', async (listRaw, vari, templ) => {
        let list = listRaw;
        if (listRaw) {
            const evalRes = await interpreter.evaluateAsync(listRaw);
            if (evalRes && evalRes.length > 0) {
                list = evalRes[0];
            }
        }

        const flattener = interpreter.ground._flattenExpr ? interpreter.ground : interpreter;
        const items = flattener._flattenExpr ? flattener._flattenExpr(list) : interpreter._flattenToList(list);

        if (!interpreter.workerPool) {
            interpreter.workerPool = new WorkerPool(
                interpreter.config.workerScript || (ENV.isNode ?
                    (new URL('../platform/node/metta-worker.js', import.meta.url).pathname) :
                    '/metta-worker.js'),
                interpreter.config.workerPoolSize || 4
            );
        }

        const results = await interpreter.workerPool.mapParallel(items, item => {
            const subst = Unify.subst(templ, {[vari.name]: item});
            return {code: `!${subst.toString()}`};
        });

        return interpreter._listify(results.map(r => {
            const parsed = interpreter.parser.parse(r);
            return parsed || sym('()');
        }));
    }, {lazy: true});
}
