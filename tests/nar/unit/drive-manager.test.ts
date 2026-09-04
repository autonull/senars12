import { beforeEach, describe, expect, test, vi } from 'vitest';
import { BUILTIN_DRIVES, createBootstrapTasks, DriveManager } from '../../../nar/src/drives';

describe('DriveManager', () => {
  let mockNar: { input: vi.Mock };
  let manager: DriveManager;

  beforeEach(() => {
    mockNar = { input: vi.fn() };
    manager = new DriveManager(mockNar as any);
  });

  test('initializes with builtin drives', () => {
    const states = manager.getAllStates();
    expect(states.length).toBe(BUILTIN_DRIVES.length);
  });

  test('each drive has correct spec', () => {
    for (const spec of BUILTIN_DRIVES) {
      const state = manager.getState(spec.id);
      expect(state).toBeDefined();
      expect(state?.spec.id).toBe(spec.id);
      expect(state?.currentIntensity).toBe(spec.targetIntensity);
      expect(state?.isActive).toBe(true);
    }
  });

  test('updateCycle decays intensity', () => {
    const initialState = manager.getState('curiosity');
    const initialIntensity = initialState?.currentIntensity ?? 0;

    manager.updateCycle();

    const afterState = manager.getState('curiosity');
    expect(afterState?.currentIntensity).toBeLessThanOrEqual(initialIntensity);
  });

  test('stimulate increases intensity', () => {
    const initialState = manager.getState('curiosity');
    const initialIntensity = initialState?.currentIntensity ?? 0;

    manager.stimulate('curiosity', 0.3);

    const afterState = manager.getState('curiosity');
    expect(afterState?.currentIntensity).toBeGreaterThan(initialIntensity);
  });

  test('stimulate caps at 1.0', () => {
    manager.stimulate('curiosity', 2.0);

    const state = manager.getState('curiosity');
    expect(state?.currentIntensity).toBeLessThanOrEqual(1.0);
  });

  test('injects goal when active', () => {
    manager.updateCycle();

    expect(mockNar.input).toHaveBeenCalled();
    const call = mockNar.input.mock.calls[0];
    expect(call[0]).toContain('(self --> curious)!');
    expect(call[1]).toBe('goal');
  });

  test('getState returns undefined for unknown drive', () => {
    const state = manager.getState('nonexistent');
    expect(state).toBeUndefined();
  });
});

describe('Bootstrap Goals', () => {
  test('creates bootstrap tasks', () => {
    const tasks = createBootstrapTasks();

    expect(tasks.length).toBe(3);
    expect(tasks[0].term).toBe('(self --> curious)! :0.70:0.60');
    expect(tasks[0].type).toBe('goal');
    expect(tasks[0].truth).toEqual({ f: 0.7, c: 0.6 });
  });

  test('extracts truth values correctly', () => {
    const tasks = createBootstrapTasks();

    expect(tasks[1].truth).toEqual({ f: 0.5, c: 0.7 });
    expect(tasks[2].truth).toEqual({ f: 0.3, c: 0.8 });
  });
});
