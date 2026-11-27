/**
 * An argument schema from its properties, with the required names as trailing
 * arguments so the property table and its required list stay adjacent and a name
 * cannot be required without being declared. The `type: 'object'` envelope and
 * the empty-`required` omission each had a dozen hand-typed sites.
 */
export const objectSpec = (properties, ...required) => ({ type: 'object', properties, ...(required.length > 0 && { required }) });
