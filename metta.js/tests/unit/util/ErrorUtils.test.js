/**
 * ErrorUtils Tests
 */

import { describe, expect, it } from '@jest/globals';
import { logError, safeAsync, safeSync } from '@senars/core';

describe('ErrorUtils', () => {
  describe('logError', () => {
    it('should log error without throwing', () => {
      const error = new Error('Test error');
      expect(() => logError(error, { test: true }, 'error', 'TestComponent')).not.toThrow();
    });

    it('should handle null error', () => {
      expect(() => logError(null, {}, 'error', 'Test')).not.toThrow();
    });

    it('should handle undefined context', () => {
      const error = new Error('Test');
      expect(() => logError(error, undefined, 'error', 'Test')).not.toThrow();
    });
  });

  describe('safeAsync', () => {
    it('should return result of successful async function', async () => {
      const fn = async () => 'success';
      const result = await safeAsync(fn, 'test async', {});
      expect(result).toBe('success');
    });

    it('should handle errors gracefully', async () => {
      const fn = async () => {
        throw new Error('Async failed');
      };
      const result = await safeAsync(fn, 'test async', {});
      expect(result).toBeNull();
    });

    it('should handle null function', async () => {
      const result = await safeAsync(null, 'test', {});
      expect(result).toBeNull();
    });
  });

  describe('safeSync', () => {
    it('should return result of successful sync function', () => {
      const fn = () => 'sync success';
      const result = safeSync(fn, 'test sync', {});
      expect(result).toBe('sync success');
    });

    it('should handle errors gracefully', () => {
      const fn = () => {
        throw new Error('Sync failed');
      };
      const result = safeSync(fn, 'test sync', {});
      expect(result).toBeNull();
    });

    it('should handle null function', () => {
      const result = safeSync(null, 'test', {});
      expect(result).toBeNull();
    });
  });
});
