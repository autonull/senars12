/**
 * Unit tests for FileLoader (Node.js adapter)
 */

import {FileLoader} from '../../../../metta/src/platform/node/FileLoader.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileLoader', () => {
    let tempDir;
    let loader;

    beforeEach(() => {
        // Create temporary directory for testing
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileloader-test-'));

        // Create test files
        fs.writeFileSync(path.join(tempDir, 'test.metta'), '(test content)');
        fs.writeFileSync(path.join(tempDir, 'core.metta'), '(core content)');

        loader = new FileLoader({baseDir: tempDir});
    });

    afterEach(() => {
        // Clean up temporary directory
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, {recursive: true, force: true});
        }
    });

    describe('constructor', () => {
        test('should initialize with base directory', () => {
            expect(loader.baseDir).toBe(tempDir);
            expect(loader.searchPaths).toContain(tempDir);
        });

        test('should accept custom search paths', () => {
            const customLoader = new FileLoader({
                baseDir: tempDir,
                searchPaths: ['/custom/path']
            });
            expect(customLoader.searchPaths).toContain('/custom/path');
            expect(customLoader.searchPaths).toContain(tempDir);
        });
    });

    describe('exists()', () => {
        test('should return true for existing file', () => {
            expect(loader.exists('test.metta')).toBe(true);
        });

        test('should return false for non-existing file', () => {
            expect(loader.exists('nonexistent.metta')).toBe(false);
        });

        test('should check all search paths', () => {
            const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileloader-test2-'));
            fs.writeFileSync(path.join(secondDir, 'other.metta'), '(other)');

            loader.addSearchPath(secondDir);
            expect(loader.exists('other.metta')).toBe(true);

            fs.rmSync(secondDir, {recursive: true, force: true});
        });
    });

    describe('read()', () => {
        test('should read file content', () => {
            const content = loader.read('test.metta');
            expect(content).toBe('(test content)');
        });

        test('should throw error for non-existing file', () => {
            expect(() => loader.read('nonexistent.metta')).toThrow();
            expect(() => loader.read('nonexistent.metta')).toThrow(/not found/);
        });

        test('should read from first matching search path', () => {
            const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileloader-test2-'));
            fs.writeFileSync(path.join(secondDir, 'test.metta'), '(second content)');

            // First path should take precedence
            const content1 = loader.read('test.metta');
            expect(content1).toBe('(test content)');

            // Add second path and verify first still wins
            loader.addSearchPath(secondDir);
            const content2 = loader.read('test.metta');
            expect(content2).toBe('(test content)');

            fs.rmSync(secondDir, {recursive: true, force: true});
        });
    });

    describe('list()', () => {
        test('should list files in directory', () => {
            const files = loader.list('.');
            expect(files).toContain('test.metta');
            expect(files).toContain('core.metta');
        });

        test('should return empty array for non-existing directory', () => {
            const files = loader.list('nonexistent');
            expect(files).toEqual([]);
        });

        test('should combine files from multiple search paths', () => {
            const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileloader-test2-'));
            fs.writeFileSync(path.join(secondDir, 'other.metta'), '(other)');

            loader.addSearchPath(secondDir);
            const files = loader.list('.');

            expect(files).toContain('test.metta');
            expect(files).toContain('other.metta');

            fs.rmSync(secondDir, {recursive: true, force: true});
        });
    });

    describe('addSearchPath()', () => {
        test('should add new search path', () => {
            const newPath = '/new/path';
            loader.addSearchPath(newPath);
            expect(loader.searchPaths).toContain(newPath);
        });

        test('should not add duplicate paths', () => {
            const initialLength = loader.searchPaths.length;
            loader.addSearchPath(tempDir);
            expect(loader.searchPaths.length).toBe(initialLength);
        });
    });
});
