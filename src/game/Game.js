/**
 * The text a perception is embedded under — the features when a game reports
 * them, the state id otherwise.
 *
 * Both embedding consumers were computing this separately and identically, so a
 * game that reports features was embedded under two different keys by two
 * subsystems: the same state, cached twice and read back as two pointers.
 * `stateId` is the fallback because a game without features has nothing finer to
 * say than its own identity.
 */
export const perceptionKey = (perception) => JSON.stringify(perception.features ?? perception.stateId);
