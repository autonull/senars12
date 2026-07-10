import { fnv1a } from './string.js';

export class BloomFilter {
  /**
   * @param {number} size - Size of the bitfield in bits
   * @param {number} hashes - Number of hash functions to use
   */
  constructor(size = 256, hashes = 5) {
    this._size = size;
    this._hashes = hashes;
    // Calculate required 32-bit integers (ceil(size / 32))
    this._buffer = new Uint32Array(Math.ceil(size / 32));
  }

  get size() {
    return this._size;
  }

  get hashes() {
    return this._hashes;
  }

  get buffer() {
    return this._buffer;
  }

  /**
   * Create a BloomFilter from existing data
   * @param {Uint32Array} buffer - The bitfield buffer
   * @param {number} size - Size in bits
   * @param {number} hashes - Number of hashes
   */
  static from(buffer, size, hashes) {
    const bf = new BloomFilter(size, hashes);
    bf._buffer.set(buffer);
    return bf;
  }

  /**
   * Add a string to the filter
   * @param {string} str
   */
  add(str) {
    this._apply(str, (index) => this._setBit(index));
  }

  /**
   * Check if a string is in the filter
   * @param {string} str
   * @returns {boolean} True if possibly present, False if definitely not
   */
  test(str) {
    return this._apply(str, (index) => this._getBit(index));
  }

  _apply(str, fn) {
    const h1 = fnv1a(str);
    const h2 = fnv1a(`${str}s`); // Simple secondary hash with salt
    const size = this._size;

    for (let i = 0; i < this._hashes; i++) {
      // Double hashing: h(i) = (h1 + i * h2) % size
      const index = (h1 + i * h2) % size;
      // Handle negative result from modulo
      const safeIndex = index < 0 ? index + size : index;
      if (fn(safeIndex) === false) {
        return false;
      }
    }
    return true;
  }

  /**
   * Merge another bloom filter into this one
   * @param {BloomFilter} other
   */
  merge(other) {
    if (other._size !== this._size || other._hashes !== this._hashes) {
      throw new Error('Cannot merge BloomFilters of different dimensions');
    }

    for (let i = 0; i < this._buffer.length; i++) {
      this._buffer[i] |= other._buffer[i];
    }
  }

  /**
   * Check if this filter overlaps with another
   * @param {BloomFilter} other
   * @returns {boolean}
   */
  intersects(other) {
    if (other._size !== this._size) {
      return false;
    } // Or throw

    for (let i = 0; i < this._buffer.length; i++) {
      if ((this._buffer[i] & other._buffer[i]) !== 0) {
        return true;
      }
    }
    return false;
  }

  clone() {
    return BloomFilter.from(this._buffer, this._size, this._hashes);
  }

  equals(other) {
    if (!other || this._size !== other._size || this._hashes !== other._hashes) {
      return false;
    }
    for (let i = 0; i < this._buffer.length; i++) {
      if (this._buffer[i] !== other._buffer[i]) {
        return false;
      }
    }
    return true;
  }

  _setBit(index) {
    const wordIndex = Math.floor(index / 32);
    const bitIndex = index % 32;
    this._buffer[wordIndex] |= 1 << bitIndex;
  }

  _getBit(index) {
    const wordIndex = Math.floor(index / 32);
    const bitIndex = index % 32;
    return (this._buffer[wordIndex] & (1 << bitIndex)) !== 0;
  }
}
