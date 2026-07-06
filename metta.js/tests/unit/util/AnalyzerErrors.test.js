import {AnalysisError, AnalyzerError, ConfigurationError, ValidationError} from '@senars/core';

describe('AnalyzerErrors', () => {
    describe('AnalyzerError', () => {
        test('initialization with original error', () => {
            const orig = new Error('Original');
            const err = new AnalyzerError('Test msg', {originalError: orig});
            expect(err).toBeInstanceOf(AnalyzerError);
            expect(err.name).toBe('AnalyzerError');
            expect(err.message).toBe('Test msg');
            expect(err.code).toBe('ANALYZER_ERROR');
            expect(err.originalError).toBe(orig);
            expect(err.timestamp).toBeDefined();
        });
        test('initialization default', () => {
            const err = new AnalyzerError('Test msg');
            expect(err.message).toBe('Test msg');
            expect(err.code).toBe('ANALYZER_ERROR');
            expect(err.originalError).toBeNull();
        });
    });
    describe('ConfigurationError', () => {
        test('initialization', () => {
            const orig = new Error('Original');
            const err = new ConfigurationError('Config err', {originalError: orig});
            expect(err).toBeInstanceOf(ConfigurationError);
            expect(err.name).toBe('ConfigurationError');
            expect(err.code).toBe('CONFIGURATION_ERROR');
            expect(err.originalError).toBe(orig);
        });
    });
    describe('AnalysisError', () => {
        test('initialization', () => {
            const orig = new Error('Original');
            const err = new AnalysisError('Analysis err', {analysisType: 'tests', originalError: orig});
            expect(err).toBeInstanceOf(AnalysisError);
            expect(err.name).toBe('AnalysisError');
            expect(err.code).toBe('ANALYSIS_ERROR_TESTS');
            expect(err.analysisType).toBe('tests');
        });
        test('unknown type', () => {
            const err = new AnalysisError('Err');
            expect(err.code).toBe('ANALYSIS_ERROR_UNKNOWN');
            expect(err.analysisType).toBe('unknown');
        });
    });
    describe('ValidationError', () => {
        test('initialization', () => {
            const orig = new Error('Original');
            const err = new ValidationError('Valid err', {field: 'field1', originalError: orig});
            expect(err).toBeInstanceOf(ValidationError);
            expect(err.name).toBe('ValidationError');
            expect(err.code).toBe('VALIDATION_ERROR');
            expect(err.field).toBe('field1');
        });
    });
});
