/**
 * Zipper.js
 * MORK-parity Phase P1-A: Zipper-Based Traversal
 * Flat Uint32Array path storage for cache-efficiency.
 */
import {exp} from './Term.js';

export class Zipper {
    constructor(root) {
        this.root = root;
        this.path = new Uint32Array(32); // index stack
        this.depth = 0;
        this.focus = root;
    }

    /**
     * Navigate down to the i-th component of the current focus.
     */
    down(i) {
        if (!this.focus || !this.focus.components || i >= this.focus.components.length) {
            return false;
        }

        // Resize path array if depth exceeds current capacity
        if (this.depth >= this.path.length) {
            const newPath = new Uint32Array(this.path.length * 2);
            newPath.set(this.path);
            this.path = newPath;
        }

        this.path[this.depth++] = i;
        this.focus = this.focus.components[i];
        return true;
    }

    /**
     * Navigate up to the parent of the current focus.
     */
    up() {
        if (this.depth === 0) {
            return false;
        }
        this.focus = this._nodeAt(--this.depth);
        return true;
    }

    /**
     * Navigate to the right sibling of the current focus.
     */
    right() {
        if (this.depth === 0) {
            return false;
        }

        const parent = this._nodeAt(this.depth - 1);
        const i = this.path[this.depth - 1];

        if (!parent || !parent.components || i + 1 >= parent.components.length) {
            return false;
        }

        this.path[this.depth - 1] = i + 1;
        this.focus = parent.components[i + 1];
        return true;
    }

    /**
     * Replace the current focus node and reconstruct the tree upward.
     * Returns the new root.
     */
    replace(node) {
        this.focus = node;
        let currentFocus = node;
        let currentDepth = this.depth;

        // Walk up the path, rebuilding the parent nodes with the new child
        while (currentDepth > 0) {
            const parentIndex = this.path[currentDepth - 1];
            const parent = this._nodeAt(currentDepth - 1);

            // Skip if parent is not a valid expression
            if (!parent || !parent.operator || parent.type !== 'compound') {
                break;
            }

            const newComps = [...parent.components];
            newComps[parentIndex] = currentFocus;

            const newParent = exp(parent.operator, newComps);
            currentFocus = newParent;
            currentDepth--;
        }

        this.root = currentFocus;
        return this.root;
    }

    /**
     * Retrieve the node at a specific depth by walking from the root.
     * @private
     */
    _nodeAt(d) {
        let curr = this.root;
        for (let i = 0; i < d; i++) {
            if (!curr || !curr.components) {
                return null;
            }
            curr = curr.components[this.path[i]];
        }
        return curr;
    }
}
