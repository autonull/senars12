import {NAR} from '../nar.js';

test('NAR integration basic', async () => {
    const nar = new NAR();
    await nar.input('bird', 'belief');
    await nar.input('swan', 'belief');
    expect(nar.memory.size).toBeDefined();
});
