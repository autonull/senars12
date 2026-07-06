/**
 * Unit tests for VirtualFS (Browser adapter)
 */

import {VirtualFS} from '../../../../metta/src/platform/browser/VirtualFS.js';

describe('VirtualFS', () => {
    let vfs;

    beforeEach(() => {
        vfs = new VirtualFS();
    });

    describe('constructor', () => {
        test('should initialize empty file system', () => {
            expect(vfs.files.size).toBe(0);
            expect(vfs.directories.size).toBe(0);
        });

        test('should pre-load files from options', () => {
            const vfsWithFiles = new VirtualFS({
                files: {
                    'test.metta': '(test content)',
                    'core.metta': '(core content)'
                }
            });

            expect(vfsWithFiles.files.size).toBe(2);
            expect(vfsWithFiles.exists('test.metta')).toBe(true);
            expect(vfsWithFiles.exists('core.metta')).toBe(true);
        });
    });

    describe('write() and read()', () => {
        test('should write and read file', () => {
            vfs.write('test.metta', '(test content)');
            expect(vfs.read('test.metta')).toBe('(test content)');
        });

        test('should overwrite existing file', () => {
            vfs.write('test.metta', '(first)');
            vfs.write('test.metta', '(second)');
            expect(vfs.read('test.metta')).toBe('(second)');
        });

        test('should track directories when writing files', () => {
            vfs.write('dir/file.metta', '(content)');
            expect(vfs.directories.has('dir')).toBe(true);
        });

        test('should handle root directory files', () => {
            vfs.write('root.metta', '(root)');
            expect(vfs.directories.has('.')).toBe(true);
        });
    });

    describe('exists()', () => {
        test('should return true for existing file', () => {
            vfs.write('test.metta', '(content)');
            expect(vfs.exists('test.metta')).toBe(true);
        });

        test('should return false for non-existing file', () => {
            expect(vfs.exists('nonexistent.metta')).toBe(false);
        });
    });

    describe('read()', () => {
        test('should throw error for non-existing file', () => {
            expect(() => vfs.read('nonexistent.metta')).toThrow();
            expect(() => vfs.read('nonexistent.metta')).toThrow(/not found in virtual file system/);
        });
    });

    describe('list()', () => {
        test('should list files in root directory', () => {
            vfs.write('file1.metta', '(1)');
            vfs.write('file2.metta', '(2)');

            const files = vfs.list('.');
            expect(files).toContain('file1.metta');
            expect(files).toContain('file2.metta');
            expect(files.length).toBe(2);
        });

        test('should list files in subdirectory', () => {
            vfs.write('dir/file1.metta', '(1)');
            vfs.write('dir/file2.metta', '(2)');
            vfs.write('other.metta', '(3)');

            const files = vfs.list('dir');
            expect(files).toContain('file1.metta');
            expect(files).toContain('file2.metta');
            expect(files).not.toContain('other.metta');
        });

        test('should not include nested subdirectories in listing', () => {
            vfs.write('dir/file.metta', '(1)');
            vfs.write('dir/subdir/nested.metta', '(2)');

            const files = vfs.list('dir');
            expect(files).toContain('file.metta');
            expect(files).not.toContain('subdir/nested.metta');
        });

        test('should return empty array for non-existing directory', () => {
            const files = vfs.list('nonexistent');
            expect(files).toEqual([]);
        });
    });

    describe('delete()', () => {
        test('should delete existing file', () => {
            vfs.write('test.metta', '(content)');
            expect(vfs.delete('test.metta')).toBe(true);
            expect(vfs.exists('test.metta')).toBe(false);
        });

        test('should return false for non-existing file', () => {
            expect(vfs.delete('nonexistent.metta')).toBe(false);
        });
    });

    describe('clear()', () => {
        test('should clear all files and directories', () => {
            vfs.write('file1.metta', '(1)');
            vfs.write('dir/file2.metta', '(2)');

            vfs.clear();

            expect(vfs.files.size).toBe(0);
            expect(vfs.directories.size).toBe(0);
            expect(vfs.exists('file1.metta')).toBe(false);
        });
    });

    describe('toObject()', () => {
        test('should convert files to object', () => {
            vfs.write('file1.metta', '(1)');
            vfs.write('file2.metta', '(2)');

            const obj = vfs.toObject();
            expect(obj).toEqual({
                'file1.metta': '(1)',
                'file2.metta': '(2)'
            });
        });

        test('should return empty object for empty file system', () => {
            expect(vfs.toObject()).toEqual({});
        });
    });
});
