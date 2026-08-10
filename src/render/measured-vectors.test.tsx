import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ViewRenderer } from "../render/ViewRenderer";
import type { ViewSpec } from "../spec/types";
const s = (root: ViewSpec["root"], extra: Partial<ViewSpec> = {}): ViewSpec =>
  ({ version: 1, title: "T", ...extra, root });
const EVIL = "data:text/html,<script>alert(1)</script>";
const JS = "javascript:alert(1)";
const bad = (html: string) =>
  /data:text\/html|javascript:|vbscript:|srcdoc|<script|<iframe|blob:/i.test(html);

const CASES: [string, ViewSpec][] = [
  ["REPORTED SidebarLink.to", s({ component: "AppShell", children: [{ component: "AppShell.Sidebar",
    children: [{ component: "AppShell.SidebarLink", props: { to: EVIL }, children: ["x"] }] }] })],
  ["REPORTED Swimlane.viewAllHref", s({ component: "Swimlane", props: { title: "t", viewAllHref: EVIL }, children: ["x"] })],
  ["RequireAuth.redirect (auto-clicks)", s({ component: "RequireAuth", props: { status: "unauthenticated", redirect: EVIL }, children: ["x"] })],
  ["case: HREF", s({ component: "Button", props: { as: "a", HREF: JS }, children: ["x"] })],
  ["array-wrapped href", s({ component: "Button", props: { as: "a", href: ["vbscript:msgbox(1)"] }, children: ["x"] })],
  ["svg data URL on href", s({ component: "Button", props: { as: "a", href: "data:image/svg+xml,<svg onload=alert(1)>" }, children: ["x"] })],
  ["as: script", s({ component: "Stack", props: { as: "script" }, children: ["alert(1)"] })],
  ["as: iframe + srcDoc", s({ component: "Button", props: { as: "iframe", srcDoc: "<script>alert(1)</script>" }, children: ["x"] })],
  ["titleAs: script", s({ component: "Swimlane", props: { title: "t", titleAs: "script" }, children: ["x"] })],
  ["nested imgProps.srcSet", s({ component: "Hero", children: [{ component: "Hero.Background",
    props: { src: "/ok.png", imgProps: { srcSet: EVIL + " 1x" } } }] })],
  ["bag via $ref", s({ component: "Hero", children: [{ component: "Hero.Background",
    props: { src: "/ok.png", imgProps: { $ref: "bag" } } }] }, { data: { bag: { type: "static", value: { srcDoc: "<script>alert(1)</script>" } } } })],
  ["ping attribute", s({ component: "Button", props: { as: "a", href: "/ok", ping: JS }, children: ["x"] })],
];

describe("every measured vector, against the finished code", () => {
  it.each(CASES)("%s", (_label, spec) => {
    const { container } = render(<ViewRenderer spec={spec} />);
    expect(bad(container.innerHTML)).toBe(false);
    expect(bad(document.head.innerHTML)).toBe(false);
  });

  // The detector must be able to say "yes". Without this the suite above passes
  // if `bad()` is broken, which is the shape of a check that cannot fail.
  it("the detector fires on markup that really does carry a payload", () => {
    expect(bad('<a href="javascript:alert(1)">x</a>')).toBe(true);
    expect(bad('<iframe srcdoc="<script>alert(1)</script>">')).toBe(true);
    expect(bad('<a href="/safe">x</a>')).toBe(false);
  });

  it("a safe document still renders its links and images", () => {
    const { container } = render(
      <ViewRenderer spec={s({ component: "Swimlane", props: { title: "t", viewAllHref: "/all" }, children: ["x"] })} />,
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/all");
  });
});
