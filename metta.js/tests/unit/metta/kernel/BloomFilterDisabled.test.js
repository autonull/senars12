import {BloomFilter} from '../../../../metta/src/kernel/BloomFilter.js';
import {METTA_CONFIG} from '../../../../metta/src/config.js';

describe('BloomFilter Default Configuration', () => {
    test('is disabled by default', () => {
        expect(METTA_CONFIG.bloomFilter).toBe(false);
        const bloom = new BloomFilter();
        expect(bloom.enabled).toBe(false);
    });

    test('returns true for everything when disabled', () => {
        const bloom = new BloomFilter();
        // Ensure it's disabled
        bloom.enabled = false;
        expect(bloom.has('nonexistent')).toBe(true);
        expect(bloom.has('existing')).toBe(true);
    });
});
