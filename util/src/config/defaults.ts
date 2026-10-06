/**
 * Defaults for a declared configuration record.
 *
 * Every connection read `config.config.<key> as T ?? default` — ten sites in
 * `io`, and a fifteen-field record literal in the IRC transport — so "what this
 * transport does with no configuration at all" was re-derived per read, in one
 * file per transport, with the answer spread across a constructor rather than
 * declared next to the type it defaults.
 *
 * {@link withDefaults} resolves a record once: the defaults are the declaration,
 * and every value a caller supplied is overlaid. A supplied `undefined` or
 * `null` is the absence of a value and falls back, which is the answer `??`
 * default gave — at one of them instead of all of them.
 * @public
 */

/**
 * A declared configuration record with its caller's values overlaid.
 *
 * {@link withDefaults} resolves a record once: the defaults are the declaration,
 * and every value a caller supplied is overlaid. A supplied `undefined` or
 * `null` is the absence of a value and falls back, which is the answer `??`
 * default gave — at one of them instead of all of them.
 *
 * `NoInfer` keeps the annotated type authoritative, so a key the defaults omit is
 * still readable off the result.
 *
 * @example
 * ```typescript
 * interface HTTPOptions {
 *   name: string;
 *   port: number;
 *   apiKey?: string;
 * }
 * const HTTP_DEFAULTS: HTTPOptions = { name: 'HTTP', port: 8080 };
 *
 * const { name, port, apiKey } = withDefaults<HTTPOptions>(config.config, HTTP_DEFAULTS);
 * ```
 */
export const withDefaults = <T extends object>(
  config: Readonly<Record<string, unknown>>,
  defaults: NoInfer<T>
): T => {
  const resolved = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined && value !== null) resolved[key] = value;
  }
  return resolved as T;
};
