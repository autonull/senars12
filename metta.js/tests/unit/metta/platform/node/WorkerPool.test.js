import path from 'path';
import {WorkerPool} from '../../../../../metta/src/platform/node/WorkerPool.js';

const workerScript = path.resolve(process.cwd(), 'metta/src/platform/node/metta-worker.js');

describe.skip('Node WorkerPool', () => {
    let pool;

    afterAll(() => {
        if (pool) {
            pool.terminate();
            pool = null;
        }
    });

    test('should execute simple MeTTa code', async () => {
        pool = new WorkerPool(workerScript, 1);
        const result = await pool.execute({code: '!(+ 1 2)'});
        expect(result).toContain('3');
    });

    test('should handle multiple workers', async () => {
        pool = new WorkerPool(workerScript, 2);
        const results = await Promise.all([
            pool.execute({code: '!(+ 1 1)'}),
            pool.execute({code: '!(+ 2 2)'})
        ]);
        expect(results).toContain('2');
        expect(results).toContain('4');
    });

    test('should handle errors gracefully', async () => {
        pool = new WorkerPool(workerScript, 1);
        await expect(pool.execute({code: '!(invalid)'})).rejects.toThrow();
    });

    test('should terminate cleanly', async () => {
        pool = new WorkerPool(workerScript, 1);
        await pool.execute({code: '!(+ 1 2)'});
        pool.terminate();
        pool = null;
    });

    test('should handle concurrent requests', async () => {
        pool = new WorkerPool(workerScript, 3);
        const promises = Array.from({length: 5}, (_, i) =>
            pool.execute({code: `!(+ ${i} 1)`})
        );
        const results = await Promise.all(promises);
        expect(results).toHaveLength(5);
    });

    test('should handle empty pool gracefully', async () => {
        pool = new WorkerPool(workerScript, 1);
        await expect(pool.execute({})).rejects.toThrow();
    });
});
