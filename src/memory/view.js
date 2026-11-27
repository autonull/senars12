/**
 * Read-only memory port — what the strategy layer reasons over.
 *
 * The strategy layer (attention, sampling, premise formation) must not depend
 * on the `Memory` facade — the facade itself owns a `CognitiveRegistry` and
 * therefore imports the strategies back. Declaring the read surface here as a
 * leaf module keeps `strategies/ → memory/` a one-way, acyclic edge and turns
 * the implicit contract into a single checked interface.
 *
 * Every member is now composed from `ports/`, so a consumer that needs storage
 * names the storage port rather than the one class that happens to own it
 * (TODO29.a §5.5). What remains concrete is `Focus`, which A4 replaces with
 * the attention owner.
 */
export {};
