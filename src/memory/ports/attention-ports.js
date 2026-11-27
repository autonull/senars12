/**
 * The one memory port that names the strategy layer.
 *
 * `AttentionOwner` is a slot a parameter graph fills with an
 * `AttentionModel`, so it is the only contract here whose vocabulary belongs to
 * `strategies/`. It is its own module for the same reason `MemoryView` sits
 * below the port barrel: keeping the `memory → strategies` edge in one file
 * means the read surface can depend on memory's own contracts
 * (`memory-ports.ts`) without dragging the strategy layer back into itself.
 */
export {};
