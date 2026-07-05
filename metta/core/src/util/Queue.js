/**
 * An efficient array-based queue implementation that uses an offset pointer
 * to avoid expensive array shifting operations.
 */
export class Queue {
    /**
     * @param {number} compactionThreshold - Minimum number of elements to process before compacting the array
     */
    constructor(compactionThreshold = 100) {
        this._items = [];
        this._offset = 0;
        this._compactionThreshold = compactionThreshold;
    }

    /**
     * Get the number of items in the queue.
     * @returns {number} The number of items
     */
    get size() {
        return this._items.length - this._offset;
    }

    /**
     * Add an item to the end of the queue.
     * @param {*} item - The item to add
     */
    enqueue(item) {
        this._items.push(item);
    }

    /**
     * Remove and return the item at the front of the queue.
     * @returns {*} The item at the front of the queue, or undefined if empty
     */
    dequeue() {
        if (this.isEmpty()) {
            this._compactIfNeeded();
            return undefined;
        }

        const item = this._items[this._offset];
        this._offset++;

        this._compactIfNeeded();

        return item;
    }

    /**
     * Get the item at the front of the queue without removing it.
     * @returns {*} The item at the front of the queue, or undefined if empty
     */
    peek() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this._items[this._offset];
    }

    /**
     * Check if the queue is empty.
     * @returns {boolean} True if the queue is empty
     */
    isEmpty() {
        return this._offset >= this._items.length;
    }

    /**
     * Clear the queue.
     */
    clear() {
        this._items = [];
        this._offset = 0;
    }

    /**
     * Compact the underlying array if the offset exceeds the threshold.
     * @private
     */
    _compactIfNeeded() {
        // Only compact if the queue is empty (reset completely)
        // OR if the offset has grown large enough to warrant a slice
        if (this.isEmpty()) {
            if (this._items.length > 0) {
                this._items = [];
                this._offset = 0;
            }
        } else if (this._offset > this._compactionThreshold) {
            this._items = this._items.slice(this._offset);
            this._offset = 0;
        }
    }
}
