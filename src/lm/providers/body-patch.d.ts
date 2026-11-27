/**
 * Shared fetch decorator: rewrite the JSON request body through a set of patches.
 *
 * Every provider-side fetch decorator was opening its own `JSON.parse`, mutating,
 * `JSON.stringify` and swallowing a parse failure — llama.cpp for `max_tokens`,
 * `grammar` and the model alias, the thinking decorator for
 * `chat_template_kwargs.enable_thinking`, and the two only happened to compose
 * because llamacpp remembered to. The parse, the pass-through-on-non-JSON rule
 * and the re-serialise are here once; a provider contributes a patch and says
 * when it applies.
 */
/**
 * One edit to a parsed request body. Return `false` to decline the request
 * entirely; the patch may await, because resolving a provider's model alias is a
 * lookup rather than a rewrite.
 */
export type BodyPatch = (body: Record<string, unknown>, input: RequestInfo | URL) => boolean | void | Promise<boolean | void>;
/**
 * Decorate `base` so each request's JSON body goes through `patch` first.
 *
 * A body that is absent, not a string, or not JSON passes through untouched:
 * a provider decorator must not be the reason a request fails to reach the
 * network.
 */
export declare const withBodyPatch: (patch: BodyPatch, base?: typeof fetch) => typeof fetch;
//# sourceMappingURL=body-patch.d.ts.map