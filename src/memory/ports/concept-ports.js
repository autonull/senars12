/**
 * Concept storage ports — the read/write surface for concept-level operations.
 *
 * Split from task ports because recalling a concept and admitting a task are
 * different authorities: a consumer that only recalls must not hold the surface
 * that writes (TODO29.a §1.1's "one owner", narrowed to the task).
 */
export {};
