import {describe, expect, test} from '@jest/globals';
import {DataLoader, EarlyStopping, LRScheduler, MetricsTracker} from '@senars/tensor/src/TrainingUtils.js';

describe('TrainingUtils', () => {
    describe('DataLoader', () => {
        test('batches data correctly', () => {
            const dataset = [1, 2, 3, 4, 5];
            const loader = new DataLoader(dataset, 2);
            const batches = [...loader];

            expect(batches.length).toBe(3);
            expect(batches[0]).toEqual([1, 2]);
            expect(batches[1]).toEqual([3, 4]);
            expect(batches[2]).toEqual([5]);
        });

        test('handles exact batch size', () => {
            const dataset = [1, 2, 3, 4];
            const loader = new DataLoader(dataset, 2);
            const batches = [...loader];

            expect(batches.length).toBe(2);
            expect(batches[0]).toEqual([1, 2]);
            expect(batches[1]).toEqual([3, 4]);
        });

        test('shuffles data', () => {
            const dataset = Array.from({length: 100}, (_, i) => i);
            const loader = new DataLoader(dataset, 10, true);
            const batches = [...loader];
            const allItems = batches.flat();

            expect(allItems.length).toBe(100);
            expect(new Set(allItems).size).toBe(100);
            expect(allItems).not.toEqual(dataset);
        });

        test('uses custom collate function', () => {
            const dataset = [1, 2, 3, 4];
            const collateFn = (batch) => batch.map(x => x * 2);
            const loader = new DataLoader(dataset, 2, false, collateFn);
            const batches = [...loader];

            expect(batches[0]).toEqual([2, 4]);
            expect(batches[1]).toEqual([6, 8]);
        });

        test('iterable multiple times', () => {
            const dataset = [1, 2, 3];
            const loader = new DataLoader(dataset, 2);

            const batches1 = [...loader];
            const batches2 = [...loader];

            expect(batches1).toEqual(batches2);
        });
    });

    describe('LRScheduler', () => {
        test('step decay reduces learning rate', () => {
            const optimizer = {lr: 0.1};
            const scheduler = new LRScheduler(optimizer, 'step', 30, 0.1);

            scheduler.step(0);
            expect(optimizer.lr).toBeCloseTo(0.1);

            scheduler.step(30);
            expect(optimizer.lr).toBeCloseTo(0.01);

            scheduler.step(60);
            expect(optimizer.lr).toBeCloseTo(0.001);
        });

        test('exponential decay', () => {
            const optimizer = {lr: 1.0};
            const scheduler = new LRScheduler(optimizer, 'exponential');

            scheduler.step(0);
            const lr0 = optimizer.lr;

            scheduler.step(10);
            const lr10 = optimizer.lr;

            expect(lr10).toBeLessThan(lr0);
            expect(lr10).toBeCloseTo(Math.exp(-1), 2);
        });

        test('cosine annealing', () => {
            const optimizer = {lr: 1.0};
            const scheduler = new LRScheduler(optimizer, 'cosine', 30, 0.1, 100);

            scheduler.step(0);
            expect(optimizer.lr).toBeCloseTo(1.0);

            scheduler.step(50);
            expect(optimizer.lr).toBeCloseTo(0.5, 1);

            scheduler.step(100);
            expect(optimizer.lr).toBeCloseTo(0, 1);
        });

        test('throws on unknown mode', () => {
            const optimizer = {lr: 0.1};
            const scheduler = new LRScheduler(optimizer, 'invalid');

            expect(() => scheduler.step(0)).toThrow(/Unknown LR scheduler mode/);
        });
    });

    describe('EarlyStopping', () => {
        test('does not stop on improvement', () => {
            const es = new EarlyStopping(3, 0.01);

            expect(es.step(1.0)).toBe(false);
            expect(es.step(0.9)).toBe(false);
            expect(es.step(0.8)).toBe(false);
        });

        test('triggers after patience exhausted', () => {
            const es = new EarlyStopping(3, 0.01);

            expect(es.step(1.0)).toBe(false); // bestLoss=1.0, counter=0
            expect(es.step(0.99)).toBe(false); // no improvement, counter=1
            expect(es.step(0.99)).toBe(false); // no improvement, counter=2
            expect(es.step(0.99)).toBe(true);  // counter=3, triggers
        });

        test('resets counter on significant improvement', () => {
            const es = new EarlyStopping(2, 0.1);

            expect(es.step(1.0)).toBe(false);  // bestLoss=1.0, counter=0
            expect(es.step(0.95)).toBe(false); // no improvement, counter=1
            expect(es.step(0.8)).toBe(false);  // significant improvement, counter=0
            expect(es.step(0.79)).toBe(false); // no improvement, counter=1
            expect(es.step(0.79)).toBe(true);  // counter=2, triggers
        });

        test('considers minDelta', () => {
            const es = new EarlyStopping(2, 0.05);

            expect(es.step(1.0)).toBe(false);  // bestLoss=1.0, counter=0
            expect(es.step(0.98)).toBe(false); // no sufficient improvement (< 0.05), counter=1
            expect(es.step(0.96)).toBe(true);  // no sufficient improvement, counter=2, triggers
        });

        test('reset clears state', () => {
            const es = new EarlyStopping(2, 0.01);

            es.step(1.0);
            es.step(1.0);
            es.reset();

            expect(es.bestLoss).toBe(Infinity);
            expect(es.counter).toBe(0);
        });
    });

    describe('MetricsTracker', () => {
        test('logs metrics by epoch', () => {
            const tracker = new MetricsTracker();

            tracker.log(0, {loss: 1.0, acc: 0.5});
            tracker.log(1, {loss: 0.8, acc: 0.6});

            const lossHistory = tracker.get('loss');
            expect(lossHistory).toHaveLength(2);
            expect(lossHistory[0]).toEqual({epoch: 0, value: 1.0});
            expect(lossHistory[1]).toEqual({epoch: 1, value: 0.8});
        });

        test('returns empty array for unknown metric', () => {
            const tracker = new MetricsTracker();
            expect(tracker.get('unknown')).toEqual([]);
        });

        test('handles multiple metrics', () => {
            const tracker = new MetricsTracker();

            tracker.log(0, {loss: 1.0, acc: 0.5, f1: 0.4});
            tracker.log(1, {loss: 0.8, acc: 0.6, f1: 0.5});

            expect(Object.keys(tracker.history).length).toBe(3);
        });

        test('clear resets history', () => {
            const tracker = new MetricsTracker();

            tracker.log(0, {loss: 1.0});
            tracker.clear();

            expect(Object.keys(tracker.history).length).toBe(0);
        });

        test('summary provides stats', () => {
            const tracker = new MetricsTracker();

            tracker.log(0, {loss: 1.0, acc: 0.5});
            tracker.log(1, {loss: 0.8, acc: 0.6});
            tracker.log(2, {loss: 0.9, acc: 0.7});

            const summary = tracker.summary();

            expect(summary.loss.latest).toBe(0.9);
            expect(summary.loss.best).toBe(0.8);
            expect(summary.loss.bestEpoch).toBe(1);

            expect(summary.acc.latest).toBe(0.7);
            expect(summary.acc.best).toBe(0.7);
            expect(summary.acc.bestEpoch).toBe(2);
        });
    });
});
