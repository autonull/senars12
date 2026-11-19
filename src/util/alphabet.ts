/**
 * The alphabet of valid Narsese atom characters.
 * Defined separately to avoid circular dependencies between util and terms.
 *
 * Variables (`? $ # * %`) and quoted atoms are grammar concerns, not alphabet concerns.
 */
export const NARSESE_ATOM_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_^';