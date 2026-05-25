import {describe, expect, jest, test, beforeEach, afterEach} from '@jest/globals';
import {AutonomousScheduler, type SchedulerConfig} from '../../src/agent/AutonomousScheduler.js';

const flushMicrotasks = () => Promise.resolve();

describe('AutonomousScheduler', () => {
  let mockNar: any;
  let config: SchedulerConfig;
  let scheduler: AutonomousScheduler;

  beforeEach(() => {
    jest.useFakeTimers();
    mockNar = {run: jest.fn(() => Promise.resolve(5))};
    config = {
      reasoningStepsPerWake: 10,
      wakeupIntervalMs: 1000,
      sleepIntervalMs: 500,
      enableLMRules: true,
      effortLevel: 0.5,
    };
    scheduler = new AutonomousScheduler(mockNar, config);
  });

  afterEach(() => {
    scheduler.stop();
    jest.useRealTimers();
  });

  test('start() sets up interval timer', () => {
    const spy = jest.spyOn(globalThis, 'setInterval');
    scheduler.start();
    expect(spy).toHaveBeenCalledWith(expect.any(Function), config.wakeupIntervalMs);
    spy.mockRestore();
  });

  test('stop() clears interval timer', () => {
    const spy = jest.spyOn(globalThis, 'clearInterval');
    scheduler.start();
    scheduler.stop();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('stop() is safe when not started', () => {
    expect(() => scheduler.stop()).not.toThrow();
  });

  test('stop() is safe when called multiple times', () => {
    scheduler.start();
    scheduler.stop();
    scheduler.stop();
  });

  test('runs nar.run with correct cycles when idle threshold exceeded', async () => {
    scheduler.start();
    jest.advanceTimersByTime(config.wakeupIntervalMs + config.sleepIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).toHaveBeenCalledTimes(1);
    expect(mockNar.run).toHaveBeenCalledWith(5);
  });

  test('does not run when idle time < sleepIntervalMs', async () => {
    const highSleepConfig = {...config, sleepIntervalMs: 2000};
    const highSleepScheduler = new AutonomousScheduler(mockNar, highSleepConfig);
    highSleepScheduler.start();
    jest.advanceTimersByTime(highSleepConfig.wakeupIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(highSleepConfig.sleepIntervalMs - highSleepConfig.wakeupIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).toHaveBeenCalledTimes(1);
    highSleepScheduler.stop();
  });

  test('effortLevel scales cycles: 0.3 * 10 = 3', async () => {
    const lowEffortConfig = {...config, effortLevel: 0.3};
    const lowScheduler = new AutonomousScheduler(mockNar, lowEffortConfig);
    lowScheduler.start();
    jest.advanceTimersByTime(lowEffortConfig.wakeupIntervalMs + lowEffortConfig.sleepIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).toHaveBeenCalledWith(3);
    lowScheduler.stop();
  });

  test('effortLevel=0 produces 0 cycles, nar.run not called', async () => {
    const zeroConfig = {...config, effortLevel: 0};
    const zeroScheduler = new AutonomousScheduler(mockNar, zeroConfig);
    zeroScheduler.start();
    jest.advanceTimersByTime(zeroConfig.wakeupIntervalMs + zeroConfig.sleepIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).not.toHaveBeenCalled();
    zeroScheduler.stop();
  });

  test('runs repeatedly on each wake interval when idle', async () => {
    scheduler.start();
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(config.wakeupIntervalMs + config.sleepIntervalMs);
      await flushMicrotasks();
    }
    expect(mockNar.run).toHaveBeenCalledTimes(3);
  });

  test('markUserInput() resets idle time, delaying background run past sleep threshold', async () => {
    const highSleepConfig = {...config, sleepIntervalMs: 2000};
    const highSleepScheduler = new AutonomousScheduler(mockNar, highSleepConfig);
    highSleepScheduler.start();
    jest.advanceTimersByTime(highSleepConfig.wakeupIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).not.toHaveBeenCalled();
    highSleepScheduler.markUserInput();
    jest.advanceTimersByTime(highSleepConfig.wakeupIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(highSleepConfig.sleepIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).toHaveBeenCalledTimes(1);
    highSleepScheduler.stop();
  });

  test('running flag prevents overlapping when checkAndRun already busy', async () => {
    let resolveRun: (v: number) => void;
    mockNar.run.mockImplementation(() => new Promise<number>(resolve => { resolveRun = resolve; }));
    scheduler.start();
    jest.advanceTimersByTime(config.wakeupIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).toHaveBeenCalledTimes(1);
    mockNar.run.mockClear();
    jest.advanceTimersByTime(config.wakeupIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).not.toHaveBeenCalled();
    resolveRun!(5);
    await flushMicrotasks();
    scheduler.stop();
  });

  test('handles rapid markUserInput calls without throwing', () => {
    scheduler.start();
    for (let i = 0; i < 100; i++) scheduler.markUserInput();
    scheduler.stop();
  });

  test('handles start/stop/start cycle', () => {
    scheduler.start();
    scheduler.stop();
    scheduler.start();
    scheduler.stop();
  });

  test('does not crash if nar.run throws', async () => {
    mockNar.run.mockImplementation(() => Promise.reject(new Error('NAR error')));
    scheduler.start();
    jest.advanceTimersByTime(config.wakeupIntervalMs);
    await flushMicrotasks();
    await flushMicrotasks();
    scheduler.stop();
  });

  test('runs again after error (running flag reset in finally)', async () => {
    mockNar.run.mockImplementation(() => Promise.reject(new Error('NAR error')));
    scheduler.start();
    jest.advanceTimersByTime(config.wakeupIntervalMs);
    await flushMicrotasks();
    await flushMicrotasks();
    mockNar.run.mockClear();
    mockNar.run.mockImplementation(() => Promise.resolve(5));
    jest.advanceTimersByTime(config.wakeupIntervalMs);
    await flushMicrotasks();
    expect(mockNar.run).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });
});
