import { describe, expect, it } from "vitest";

import { extendContracts } from "../spec/contracts";
import {
  type ContractScope,
  DEFAULT_CATEGORIES,
  defaultReferenceContracts,
  renderReferenceRegions,
  renderViewSpecReference,
  scopeContracts,
} from "./index";
import { replaceGeneratedRegion } from "./regions";

/**
 * The component vocabulary of a real producer: every distinct name across 23
 * stored turns of an LLM-authored tutoring app, reported in issue #3.
 *
 * Kept verbatim rather than tidied into a synthetic list, because the shape is
 * the point — 17 roots and one compound part, out of 175 addressable names, and
 * a part whose root the producer also uses.
 */
const AUTHORED = [
  "Stack",
  "Row",
  "Text",
  "Label",
  "Markdown",
  "Radio",
  "Card",
  "FieldError",
  "Stepper.Step",
  "Badge",
  "Textarea",
  "FormActions",
  "Button",
  "CodeBlock",
  "Alert",
  "Stepper",
  "Divider",
  "Input",
];

/** The components a rendered table actually documents, in the order listed. */
function documented(components: string): string[] {
  return [...components.matchAll(/^\| `([\w.]+)` \|/gm)].map((row) => row[1]);
}

/** One generated region of a document, marker to marker. */
function region(doc: string, id: string): string {
  const found = new RegExp(
    `<!-- GENERATED:${id} -->\\n([\\s\\S]*?)\\n<!-- /GENERATED:${id} -->`,
  ).exec(doc);
  if (found === null) throw new Error(`the document has no GENERATED:${id} region`);
  return found[1];
}

describe("scopeContracts", () => {
  it("keeps exactly the components asked for, and drops the other 150-odd", () => {
    const scoped = scopeContracts(defaultReferenceContracts, { include: AUTHORED });
    expect(Object.keys(scoped).sort()).toEqual([...AUTHORED].sort());
  });

  it("carries a root's compound parts, so its Parts column is not a lie", () => {
    const scoped = scopeContracts(defaultReferenceContracts, { include: ["Tabs"] });
    expect(Object.keys(scoped)).toContain("Tabs.Panel");
    const { components } = renderReferenceRegions(scoped);
    expect(components).toContain("`.Panel`");
  });

  it("carries a part's root, and the root brings its siblings", () => {
    // `AppShell` has eight parts, so this is where "add the root" and "close
    // over the root" diverge: adding the root alone leaves it advertising one
    // part of eight while the other seven stay renderable — the exact lie the
    // rule exists to prevent, produced by the rule meant to prevent it.
    const all = Object.keys(defaultReferenceContracts).filter(
      (name) => name === "AppShell" || name.startsWith("AppShell."),
    );
    expect(all.length).toBe(9);
    expect(Object.keys(scopeContracts(defaultReferenceContracts, { include: ["AppShell.Navbar"] })))
      .toEqual(all);
    expect(Object.keys(scopeContracts(defaultReferenceContracts, { include: ["Tabs.Panel"] })))
      .toEqual(["Tabs", "Tabs.List", "Tabs.Tab", "Tabs.Panel"]);
  });

  it("accepts a Set as well as an array", () => {
    expect(Object.keys(scopeContracts(defaultReferenceContracts, { include: new Set(["Card"]) })))
      .toEqual(["Card"]);
  });

  it("excluding a root excludes its parts", () => {
    const scoped = scopeContracts(defaultReferenceContracts, { exclude: ["Tabs"] });
    expect(Object.keys(scoped).filter((name) => name.startsWith("Tabs"))).toEqual([]);
  });

  it("excluding a part leaves the root, which still holds the others", () => {
    const scoped = scopeContracts(defaultReferenceContracts, { exclude: ["Tabs.Panel"] });
    expect(Object.keys(scoped)).toContain("Tabs");
    expect(Object.keys(scoped)).not.toContain("Tabs.Panel");
    // The Parts column is read off the surviving names, so it loses the part
    // too. Its curated *note* still names `.Panel`: a note is hand-written
    // advice, and scoping prose is exactly what this deliberately does not do.
    const { components } = renderReferenceRegions(scoped);
    const tabs = components.split("\n").find((line) => line.startsWith("| `Tabs` |"));
    expect(tabs?.split(" | ")[1]).toBe("`.List` `.Tab`");
    expect(tabs).toContain("`.Panel` is a sibling of `.List`.");
  });

  it("keeps the library's declaration order, which decides how parts read", () => {
    const scoped = scopeContracts(defaultReferenceContracts, { include: ["Tabs"] });
    const all = Object.keys(defaultReferenceContracts).filter((name) => name.startsWith("Tabs"));
    expect(Object.keys(scoped)).toEqual(all);
  });

  it("ignores a name listed twice", () => {
    const scoped = scopeContracts(defaultReferenceContracts, { include: ["Card", "Card"] });
    expect(Object.keys(scoped)).toEqual(["Card"]);
  });

  it("scopes a host's own registered component alongside the library's", () => {
    const merged = extendContracts(defaultReferenceContracts, {
      LessonPlayer: { category: "Media", note: "Bind `lesson` with `$ref`." },
    });
    const scoped = scopeContracts(merged, { include: ["Card", "LessonPlayer"] });
    expect(Object.keys(scoped).sort()).toEqual(["Card", "LessonPlayer"]);
  });

  describe("refuses a scope it cannot honour", () => {
    it("reports a name no contract holds, rather than a reference missing it", () => {
      expect(() => scopeContracts(defaultReferenceContracts, { include: ["Card", "Cadr"] })).toThrow(
        /no contract for "Cadr"/,
      );
    });

    it("suggests the name a typo most likely meant", () => {
      expect(() => scopeContracts(defaultReferenceContracts, { include: ["Cadr"] })).toThrow(
        /did you mean "Card"/,
      );
    });

    it("does not resolve an inherited member as a component", () => {
      // A **plain object literal**, not `defaultReferenceContracts`. The latter
      // is built by `extendContracts`, which returns a null-prototype object —
      // so `"constructor" in it` is already false and the fixture would pass
      // with the own-property guard deleted. A host writing its contracts as a
      // literal, which is the documented way, is the case that needs the guard.
      const hostContracts = { Widget: { category: "Layout" } };
      expect(Object.getPrototypeOf(hostContracts)).toBe(Object.prototype);
      for (const inherited of ["constructor", "toString", "hasOwnProperty"]) {
        expect(() => scopeContracts(hostContracts, { include: [inherited] })).toThrow(
          new RegExp(`no contract for "${inherited}"`),
        );
      }
      // And the result a caller goes on to index carries no prototype either.
      expect(Object.getPrototypeOf(scopeContracts(hostContracts, { include: ["Widget"] }))).toBe(
        null,
      );
    });

    it("refuses an empty list, which is a scope that failed to build", () => {
      // An empty include documents nothing; an empty exclude documents
      // everything. Neither is what a caller computing a list from their own
      // stored documents meant by handing over zero names.
      expect(() => scopeContracts(defaultReferenceContracts, { include: [] })).toThrow(
        /`include` is empty/,
      );
      expect(() => scopeContracts(defaultReferenceContracts, { exclude: [] })).toThrow(
        /`exclude` is empty/,
      );
      expect(() => scopeContracts(defaultReferenceContracts, { include: new Set<string>() })).toThrow(
        /`include` is empty/,
      );
    });

    it("reports an unknown name on the exclude path too", () => {
      // Quieter than the include case and still worth a throw: an exclusion
      // that has stopped matching silently re-admits a component the caller
      // deliberately removed.
      expect(() => scopeContracts(defaultReferenceContracts, { exclude: ["Cadr"] })).toThrow(
        /no contract for "Cadr" \(did you mean "Card"\?\)/,
      );
    });

    it("refuses a scope of components the reference does not document", () => {
      // `AvatarUpload` is in the contracts (it carries a `name` rule) but has no
      // category, because a document cannot drive it. Scoping to it used to
      // reach a throw advising the caller to use `defaultReferenceContracts` —
      // which is exactly what they had passed.
      expect(() => renderViewSpecReference({ include: ["AvatarUpload"] })).toThrow(
        /`AvatarUpload` is not a documented component/,
      );
      expect(() => renderViewSpecReference({ include: ["AvatarUpload"] })).not.toThrow(
        /not `defaultContracts`/,
      );
    });

    it("refuses excluding everything", () => {
      expect(() =>
        scopeContracts(defaultReferenceContracts, {
          exclude: Object.keys(defaultReferenceContracts),
        }),
      ).toThrow(/keeps no components/);
    });

    it("refuses both lists at once, and neither", () => {
      // Two lists would have to agree about every name, and cannot be made to.
      // `ContractScope` already refuses both spellings at compile time; these
      // are the JavaScript callers the type never reaches, and the reason the
      // check exists at runtime as well.
      const both = { include: ["Card"], exclude: ["Row"] } as unknown as ContractScope;
      const neither = {} as unknown as ContractScope;
      expect(() => scopeContracts(defaultReferenceContracts, both)).toThrow(/exactly one/);
      expect(() => scopeContracts(defaultReferenceContracts, neither)).toThrow(/exactly one/);
    });
  });
});

describe("propLimit", () => {
  const wide = scopeContracts(defaultReferenceContracts, { include: ["DataTable"] });

  it("truncates at seven by default, which is what the full reference does", () => {
    const { components } = renderReferenceRegions(wide);
    expect(components).toContain("+21 more");
  });

  it("lists every prop when the scope is narrow enough to afford them", () => {
    const { components } = renderReferenceRegions(wide, { propLimit: false });
    expect(components).not.toMatch(/\+\d+ more/);
    const declared = defaultReferenceContracts.DataTable.props ?? [];
    expect(declared.length).toBe(28);
    for (const prop of declared) expect(components).toContain(`\`${prop.key}`);
  });

  it("reaches the whole document, which is where the docs point", () => {
    // The README's headline call passes `propLimit` to `renderViewSpecReference`,
    // not to `renderReferenceRegions` — and forwarding it was the one step no
    // test exercised.
    const capped = renderViewSpecReference({ include: ["DataTable"] });
    const complete = renderViewSpecReference({ include: ["DataTable"], propLimit: false });
    expect(capped).toContain("+21 more");
    expect(complete).not.toContain("+21 more");
    expect(complete.length).toBeGreaterThan(capped.length);
  });

  it("refuses a limit that would print a props cell naming no props", () => {
    // `number | false` invites `0`, and `slice(0, 0)` used to render
    // "` · +28 more`" — a dangling separator ahead of a count of nothing.
    // A negative one silently dropped the last prop of every row.
    for (const propLimit of [0, -1, 1.5, Number.NaN]) {
      expect(() => renderReferenceRegions(wide, { propLimit }), String(propLimit)).toThrow(
        /positive integer or false/,
      );
    }
    expect(() => renderReferenceRegions(wide, { propLimit: 1 })).not.toThrow();
  });

  it("clips a type too long for a table cell rather than widening the row", () => {
    const long = `"${"a".repeat(40)}"|"${"b".repeat(40)}"`;
    expect(long.length).toBeGreaterThan(72);
    const cellOf = (type: string) =>
      renderReferenceRegions(
        { Widget: { category: "Layout", props: [{ key: "mode", optional: true, type }] } },
        // No ellipsis in the blurb: the first version of this test asserted
        // `toContain("…")` against a blurb that was itself an ellipsis, and
        // passed with the clipping deleted.
        { categories: [{ name: "Layout", blurb: "Structure." }] },
      )
        .components.split("\n")
        .filter((line) => line.startsWith("| `Widget` |"))[0];

    // Clipped at 69 characters, then the pipes escaped — never the other way
    // round, which could split an escape and end the table cell early.
    expect(cellOf(long)).toContain(`${long.slice(0, 69).replace(/\|/g, "\\|")}…`);
    expect(cellOf(long)).not.toContain(long.replace(/\|/g, "\\|"));
    // A type that fits is passed through whole, ellipsis and all boundaries.
    const short = '"a"|"b"';
    expect(cellOf(short)).toContain('`mode?`: "a"\\|"b"');
    expect(cellOf(short)).not.toContain("…");
  });
});

describe("replaceGeneratedRegion", () => {
  const doc = "before\n<!-- GENERATED:x -->\nold\n<!-- /GENERATED:x -->\nafter\n";

  it("rewrites the region and nothing around it", () => {
    expect(replaceGeneratedRegion(doc, "x", "new")).toBe(
      "before\n<!-- GENERATED:x -->\nnew\n<!-- /GENERATED:x -->\nafter\n",
    );
  });

  it("writes a body containing replacement patterns verbatim", () => {
    // A curated note is free to contain "$&" or a "$" before a backtick, and a
    // string replacement would expand those into the surrounding document.
    const body = "| `Chart` | $& and $` and $' and $1 and $$ |";
    expect(replaceGeneratedRegion(doc, "x", body)).toContain(`\n${body}\n`);
  });

  it("refuses a marker the document does not carry", () => {
    expect(() => replaceGeneratedRegion(doc, "slots", "…")).toThrow(/no GENERATED:slots region/);
  });

  it("treats a marker id as a name, not as a pattern", () => {
    // `id` is the caller's string. Unescaped, `.` matches any character, so
    // asking for "a.b" rewrites a region called "aXb" — the wrong-region
    // rewrite this function's throw exists to make impossible — and "x(" dies
    // in the RegExp constructor rather than at the throw.
    const other = "s\n<!-- GENERATED:aXb -->\nold\n<!-- /GENERATED:aXb -->\n";
    expect(() => replaceGeneratedRegion(other, "a.b", "new")).toThrow(
      /no GENERATED:a\.b region/,
    );
    expect(() => replaceGeneratedRegion(doc, "x(", "new")).toThrow(/no GENERATED:x\( region/);
  });
});

describe("a generated table a scope empties", () => {
  it("says so, because the prose above it promises rows", () => {
    // "These **two** call theirs… the names below are in scope inside them" is
    // hand-written and never filtered. A bare header under it leaves the reader
    // — a model — hunting for names that are not there.
    const profile = renderViewSpecReference({ include: AUTHORED });
    const emptied = region(profile, "function-children");
    expect(emptied).not.toContain("| Component |");
    expect(emptied).toContain("No component in this reference calls its `children`");
    // And it warns about the worked example still sitting underneath it.
    // "in this section", not "above": the prose is above the table and the
    // example below it, and the first wording named the wrong direction.
    expect(emptied).toContain("The prose and example in this section");
    expect(emptied).not.toContain("above naming");
    // The tables the scope does keep are still tables.
    expect(region(profile, "text-children")).toContain("| `Markdown` |");
  });

  it("keeps the header whenever there are rows to put under it", () => {
    expect(region(renderViewSpecReference(), "function-children")).toContain("| Component |");
  });
});

describe("components an example authors but a scope stops documenting", () => {
  /** Every name the hand-written prose shows being authored. */
  const authoredInProse = (doc: string) => {
    const prose = doc.replace(/<!-- GENERATED:[\s\S]*?<!-- \/GENERATED:[a-z-]+ -->/g, "");
    return [...new Set([...prose.matchAll(/"component":\s*"([\w.]+)"/g)].map((m) => m[1]))];
  };

  it("names every one of them, so the gap is stated rather than silent", () => {
    const profile = renderViewSpecReference({ include: AUTHORED });
    const documentedHere = new Set(documented(region(profile, "components")));
    const parts = new Set(AUTHORED);

    // Derived from the document, not restated: whatever the examples author
    // and the tables do not cover must appear in the warning, so an example
    // added upstream is covered without editing this test.
    const missing = authoredInProse(profile).filter(
      (name) => !documentedHere.has(name) && !parts.has(name),
    );
    expect(missing).toEqual([
      "MultiSelect",
      "MultiSelect.Tag",
      "MultiSelect.TagRemove",
      "MultiSelect.Content",
      "MultiSelect.Item",
      "MultiSelect.ItemIndicator",
      "MultiSelect.Empty",
      "Pagination",
    ]);

    const warning = region(profile, "components").split("\n")[0];
    expect(warning).toContain("This reference is scoped");
    for (const name of missing) expect(warning, name).toContain(`\`${name}\``);
    // And it says what goes wrong, not merely that something is absent: these
    // components still render, which is why a missing prop table is dangerous.
    expect(warning).toContain("not documented here");
    expect(warning).toContain("renders it");
    // No direction: the examples sit both above and below this region, and two
    // drafts of this sentence — and of the empty-table one — named the wrong
    // one. A claim about layout is a claim, and this document is generated.
    expect(warning).not.toMatch(/examples? (above|below)/);
  });

  it("says nothing when the document documents everything it demonstrates", () => {
    // The unscoped case, and the reason `VIEWSPEC.md` is unchanged by this.
    const full = renderViewSpecReference();
    expect(authoredInProse(full).filter((name) => !(name in defaultReferenceContracts))).toEqual([]);
    expect(region(full, "components")).not.toContain("This reference is scoped");
    expect(region(full, "components").startsWith("### Layout")).toBe(true);
  });

  it("counts a component the scope does cover as covered", () => {
    // `Markdown`, `Card` and `Badge` are authored in examples and are in scope,
    // so a warning naming them would be noise that teaches the model to skim.
    const warning = region(renderViewSpecReference({ include: AUTHORED }), "components");
    for (const inScope of ["`Card`,", "`Badge`,", "`Markdown`,"]) {
      expect(warning.split("\n")[0]).not.toContain(inScope);
    }
  });
});

describe("renderViewSpecReference", () => {
  it("scopes the generated regions and leaves the prose whole", () => {
    const profile = renderViewSpecReference({ include: AUTHORED });

    // The component table documents the 17 roots and nothing else. The compound
    // part carries no category of its own, so it appears in Stepper's Parts
    // column rather than as a row — which is how the full reference reads too.
    // Sorted, because the table groups by category before it sorts by name.
    expect(documented(region(profile, "components")).sort()).toEqual(
      AUTHORED.filter((name) => !name.includes(".")).sort(),
    );
    expect(profile).toMatch(/\| `Stepper` \| `\.Step`/);

    // Every region survives, so a regenerated profile can be spliced the same way.
    for (const id of ["components", "slots", "function-children", "text-children", "not-addressable"]) {
      expect(profile).toContain(`<!-- GENERATED:${id} -->`);
      expect(profile).toContain(`<!-- /GENERATED:${id} -->`);
    }

    // Prose is carried, not filtered: the rules still name components the scope
    // dropped. Asserted rather than tolerated, so the day someone tries to scope
    // prose it is a decision and not an accident.
    expect(profile).toContain("`Timeline`");
    expect(profile).toContain("## Rules");
    expect(profile).toContain("### What `themeOverrides` cannot do");
  });

  it("rewrites every region it claims to, rather than passing the template through", () => {
    // The template is the committed reference, so a region left unspliced comes
    // out looking right. Scoping is the only input that can tell the two apart:
    // each of these must differ from the full document, and equal what
    // `renderReferenceRegions` says for the same contracts.
    //
    // Excluding rather than including, and these three names specifically:
    // `CommandPalette` and `MultiSelect` are the only two components with
    // function children and `Markdown` the only one with text children, so
    // dropping all three is what makes every region move at once. The
    // producer's own include-scope leaves the text-children table identical,
    // which would have proved nothing.
    const exclude = ["Markdown", "CommandPalette", "MultiSelect"];
    const scoped = scopeContracts(defaultReferenceContracts, { exclude });
    const profile = renderViewSpecReference({ exclude });
    const full = renderViewSpecReference();
    const regions = renderReferenceRegions(scoped);

    for (const [id, body] of [
      ["slots", regions.slots],
      ["function-children", regions.functionChildren],
      ["text-children", regions.textChildren],
    ] as const) {
      expect(region(profile, id), id).toBe(body);
      expect(region(profile, id), id).not.toBe(region(full, id));
    }

    // The components region carries one thing `renderReferenceRegions` cannot
    // know about — the warning naming components the *prose* authors and these
    // contracts no longer cover. The tables under it are still exactly what the
    // region renderer produced.
    expect(region(profile, "components")).not.toBe(region(full, "components"));
    expect(region(profile, "components").endsWith(regions.components)).toBe(true);
    expect(region(profile, "components")).toContain("This reference is scoped");
  });

  it("keeps the not-addressable table whole, because absence is what a scope makes", () => {
    const profile = renderViewSpecReference({ include: AUTHORED });
    // Carried with the prose, not re-rendered — so this asserts the committed
    // table survives a scope, and `contracts.test.ts` relates that table to
    // `not-addressable.json`. Neither check can stand in for the other.
    expect(documented(region(profile, "not-addressable"))).toEqual([
      "AvatarUpload",
      "Breadcrumbs.Divider",
      "FileUpload",
      "FormProvider",
      "Repeater",
      "RouterAdapterProvider",
      "ToastProvider",
    ]);
  });

  it("drops a category heading no surviving component sits under", () => {
    const profile = renderViewSpecReference({ include: ["Card"] });
    expect(profile).toContain("### Layout");
    // Card is the only survivor, so nine of the ten sections have nothing to
    // say. All nine are named — `Action` most of all, the heading that once
    // vanished silently and took Button, IconButton and CopyButton with it.
    for (const category of DEFAULT_CATEGORIES) {
      if (category.name === "Layout") continue;
      expect(profile, category.name).not.toContain(`### ${category.name}`);
    }
  });

  it("is materially smaller than the reference it is derived from", () => {
    const full = Buffer.byteLength(renderViewSpecReference(), "utf8");
    const profile = Buffer.byteLength(renderViewSpecReference({ include: AUTHORED }), "utf8");
    // The measured saving for this vocabulary is 47%. Asserted as a floor a long
    // way below it: this is here to catch a scope that silently stops scoping,
    // not to freeze a byte count that legitimately moves with every release.
    expect(profile).toBeLessThan(full * 0.75);
  });
});
