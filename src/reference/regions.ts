/**
 * Splicing generated tables into a hand-written markdown document.
 *
 * **Not part of `/reference`'s public surface, deliberately.** It lives in its
 * own module so `renderViewSpecReference` and the doc generator share one
 * implementation without that implementation becoming API: `exports` carries no
 * wildcard, so nothing outside this repository can reach it. A host keeping its
 * own reference document with the same markers is a plausible caller and not a
 * demonstrated one, and an export is far cheaper to add than to withdraw.
 */

/**
 * Rewrites a `<!-- GENERATED:x -->…<!-- /GENERATED:x -->` region, leaving
 * everything around it alone.
 *
 * Throws on a marker the document does not carry, because the alternative is a
 * reference that silently stops being regenerated while every check still
 * passes.
 */
export function replaceGeneratedRegion(doc: string, id: string, body: string): string {
  // Escaped, because `id` need not be a literal: an unescaped `.` in
  // `"table.rows"` matches a *different* marker and rewrites the wrong region —
  // the silent failure this function's own throw exists to prevent — and a `(`
  // throws a SyntaxError from a regex the caller never wrote.
  const marker = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `(<!-- GENERATED:${marker} -->)[\\s\\S]*?(<!-- /GENERATED:${marker} -->)`,
  );
  if (!pattern.test(doc)) throw new Error(`the document has no GENERATED:${id} region`);
  // A function replacer, because a note is free to contain `$&` or "$`" and a
  // string replacement would expand it into something the author never wrote.
  return doc.replace(pattern, (_, open: string, close: string) => `${open}\n${body}\n${close}`);
}
