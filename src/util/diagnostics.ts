/**
 * One rendering of a schema failure, shared by every validation boundary.
 */

/** One issue's worth of what a diagnostic can say; the shape every schema issue already has. */
export interface SchemaIssue {
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/**
 * The monorepo's one rendering of a schema failure. Four validators used to
 * spell this out, in two formats, one of which dropped the path entirely — so
 * the same invalid config produced a different diagnostic depending on which
 * boundary rejected it.
 */
export const formatIssues = (issues: readonly SchemaIssue[], separator = '; '): string =>
  issues
    .map((issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`)
    .join(separator);
