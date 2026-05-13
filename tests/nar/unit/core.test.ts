import {
    Budget,
    ConfigurationError,
    createBudget,
    createTask,
    DEFAULT_CONFIG,
    failure,
    isFailure,
    isSuccess,
    NARError,
    OperationError,
    success,
    ValidationError
} from '../../../src/nar/types';
import {atom, Truth} from '../../../src/nar/terms';

describe('Budget', () => {
    test('createBudget creates frozen object', () => {
        const budget = createBudget(0.8, 0.9, 0.7, 5, 3);
        expect(budget.priority).toBe(0.8);
        expect(budget.durability).toBe(0.9);
        expect(budget.quality).toBe(0.7);
        expect(budget.cycles).toBe(5);
        expect(budget.depth).toBe(3);
        expect(Object.isFrozen(budget)).toBe(true);
    });

    test('createBudget uses defaults', () => {
        const budget = createBudget(0.5);
        expect(budget.priority).toBe(0.5);
        expect(budget.durability).toBe(0.8);
        expect(budget.quality).toBe(0.9);
        expect(budget.cycles).toBe(0);
        expect(budget.depth).toBe(0);
    });


});

describe('Task', () => {
    test('createTask creates task with defaults', () => {
        const term = atom('test');
        const truth = Truth.create(0.9, 0.8);
        const task = createTask(term, 'belief', truth);
        expect(task.term).toBe(term);
        expect(task.type).toBe('belief');
        expect(task.truth).toBe(truth);
        expect(task.derived).toBe(false);
        expect(task.stamp.id).toBeDefined();
        expect(task.occurrenceTime).toBeDefined();
    });

    test('createTask accepts budget object', () => {
        const term = atom('test');
        const budget: Budget = createBudget(0.7);
        const task = createTask(term, 'goal', Truth.NEUTRAL, budget);
        expect(task.budget).toBe(budget);
        expect(task.budget.priority).toBe(0.7);
    });
});

describe('Result types', () => {
    test('success creates success result', () => {
        const result = success(42);
        expect(result.success).toBe(true);
        expect(result.data).toBe(42);
    });

    test('failure creates failure result', () => {
        const err = new Error('test');
        const result = failure(err);
        expect(result.success).toBe(false);
        expect(result.error).toBe(err);
    });

    test('isSuccess detects success', () => {
        expect(isSuccess(success(1))).toBe(true);
        expect(isSuccess(failure(new Error()))).toBe(false);
    });

    test('isFailure detects failure', () => {
        expect(isFailure(failure(new Error()))).toBe(true);
        expect(isFailure(success(1))).toBe(false);
    });
});

describe('Error types', () => {
    test('NARError includes code and context', () => {
        const err = new NARError('msg', 'CODE', {key: 'val'});
        expect(err.name).toBe('NARError');
        expect(err.code).toBe('CODE');
        expect(err.context).toEqual({key: 'val'});
    });

    test('ValidationError has correct code', () => {
        const err = new ValidationError('invalid', {field: 'x'});
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.name).toBe('ValidationError');
    });

    test('ConfigurationError has correct code', () => {
        const err = new ConfigurationError('bad config');
        expect(err.code).toBe('CONFIGURATION_ERROR');
    });

    test('OperationError has correct code', () => {
        const err = new OperationError('failed');
        expect(err.code).toBe('OPERATION_ERROR');
    });
});

describe('DEFAULT_CONFIG', () => {
    test('has expected values', () => {
        expect(DEFAULT_CONFIG.maxConcepts).toBe(1000);
        expect(DEFAULT_CONFIG.priorityThreshold).toBe(0.5);
        expect(DEFAULT_CONFIG.activationDecayRate).toBe(0.01);
        expect(DEFAULT_CONFIG.consolidationInterval).toBe(10);
        expect(DEFAULT_CONFIG.cpuThrottleMs).toBe(10);
        expect(DEFAULT_CONFIG.maxDerivationDepth).toBe(10);
        expect(DEFAULT_CONFIG.maxDerivationsPerStep).toBe(1000);
    });

    test('is frozen', () => {
        expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
    });
});