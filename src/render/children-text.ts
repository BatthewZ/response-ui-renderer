import { isCondNode, isEachNode, isRefNode, type ViewNode } from "../spec/types";
import { type RefContext, refToText, resolveRef } from "./resolve-ref";

/** Bounds recursion the way `NodeRenderer` and `resolveDeep` bound their own. */
const MAX_TEXT_DEPTH = 20;

/**
 * The text a document's children make, for the roots that parse `children`
 * rather than place it — see `TEXT_CHILDREN`.
 *
 * Concatenated **verbatim**. Joining on a newline would read well for a document
 * that splits a block per child and silently corrupt one that interpolates
 * (`["Owner: ", { "$ref": "data.owner" }]`), and there is no way to tell the two
 * apart. Verbatim is the only rule that leaves whitespace where the author put
 * it, and it is what the reference tells an author to expect.
 *
 * `$each` binds `row` / `rowIndex` here exactly as it does in a rendered tree,
 * so a list of markdown fragments concatenates without leaving the format.
 */
export function childrenToText(
  children: readonly ViewNode[] | undefined,
  context: RefContext,
): string {
  if (!children) return "";
  return children.map((child) => nodeToText(child, context, 0)).join("");
}

function nodeToText(node: ViewNode, context: RefContext, depth: number): string {
  if (depth > MAX_TEXT_DEPTH) return "";
  if (typeof node === "string") return node;
  if (node == null || typeof node !== "object") return "";

  if (isRefNode(node)) return refToText(resolveRef(node.$ref, context)) ?? "";

  if (isCondNode(node)) {
    const branch = resolveRef(node.$cond, context) ? node.then : node.else;
    return branch === undefined ? "" : nodeToText(branch, context, depth + 1);
  }

  if (isEachNode(node)) {
    const resolved = resolveRef(node.$each, context);
    if (!Array.isArray(resolved)) return "";
    // Annotated because `Array.isArray` narrows `unknown` to `any[]`.
    const items: unknown[] = resolved;
    return items
      .map((item, index) =>
        nodeToText(
          node.node,
          {
            ...context,
            vars: { ...context.vars, [node.as]: item, [`${node.as}Index`]: index },
          },
          depth + 1,
        ),
      )
      .join("");
  }

  // A component node. Nothing here can produce text, and inventing something
  // would be worse than the gap: `validateViewSpec` names it instead.
  return "";
}
