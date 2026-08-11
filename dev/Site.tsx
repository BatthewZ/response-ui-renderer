import { type ComponentType, type Ref, useEffect, useRef, useState } from "react";

import { BuilderHeaderControls } from "./BuilderHeaderControls";
import { BuilderPage } from "./BuilderPage";
import { DocsPage } from "./DocsPage";
import { Playground } from "./Playground";
import { PlaygroundHeaderControls } from "./PlaygroundHeaderControls";
import { ReferenceHeaderControls } from "./ReferenceHeaderControls";
import { BUILDER_PAGE, type PageId, pageOf, PLAYGROUND_PAGE, requestedPage } from "./site";
import { SiteHeader } from "./SiteHeader";

/**
 * What each page adds to the top bar, if anything.
 *
 * Keyed by page rather than branched on, so a page that grows a control declares
 * it in one place and the frame keeps knowing nothing about any page in
 * particular — which is the whole reason the bar is mounted here.
 */
const HEADER_CONTROLS: Partial<Record<PageId, ComponentType>> = {
  playground: PlaygroundHeaderControls,
  builder: BuilderHeaderControls,
  reference: ReferenceHeaderControls,
};

/**
 * What is under the bar.
 *
 * Written as narrowing rather than as a lookup so the last branch is reached
 * with `page` already proven to be a page that *is* a document — a map would
 * need a cast there, and the cast is what would survive a fourth page being
 * added without one.
 */
function PageBody({ page, region }: { page: PageId; region: Ref<HTMLElement> }) {
  if (page === PLAYGROUND_PAGE) return <Playground ref={region} />;
  if (page === BUILDER_PAGE) return <BuilderPage ref={region} />;
  return <DocsPage ref={region} page={page} />;
}

/** Where the current URL points, as the frame needs it. */
function routeOf(): { page: PageId; hash: string } {
  return { page: requestedPage(window.location.search), hash: window.location.hash };
}

/**
 * The frame the pages are rendered inside, and the only thing that navigates.
 *
 * A page swap replaces what is below the bar and leaves the bar itself mounted:
 * the header does not flash, and the active link is the only thing in the chrome
 * that changes.
 *
 * The click is caught here rather than in the header because the header is not
 * the only thing that links to a page: prose links naming a repository document
 * are rewritten to page URLs, and a rewritten markdown link is an ordinary
 * anchor with no way to reach a handler. One delegated listener treats both
 * alike, and treats everything else — a new tab, a modified click, `?view=`, an
 * outbound link — as the browser navigation it still is.
 *
 * Arriving at a page is this frame's job for the same reason. A page load used
 * to do all of it for free: it put the reader at the top of the new document, or
 * at the fragment named, and it moved focus out of the link that had just been
 * followed and into the new page — which is how someone reading by screen reader
 * learns anything happened at all. None of that survives a swap that only
 * replaces the children of a region that stays where it is.
 */
export function Site() {
  const [{ page, hash }, setRoute] = useState(routeOf);
  const region = useRef<HTMLElement>(null);
  const arrived = useRef(false);

  useEffect(() => {
    const sync = () =>
      setRoute((current) => {
        const next = routeOf();
        return current.page === next.page && current.hash === next.hash ? current : next;
      });

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target !== "" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== window.location.pathname) return;
      if (pageOf(url.search) === null) return;

      event.preventDefault();
      // A link to where we already are: no reload, and no history entry whose
      // only effect would be to make the back button appear broken.
      if (url.href === window.location.href) return;
      window.history.pushState(null, "", url.href);
      sync();
    };

    document.addEventListener("click", onClick);
    // `popstate` is the back button; `hashchange` is an in-page anchor the
    // browser handled itself, which moves the URL without asking this frame.
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  useEffect(() => {
    const anchor = hash ? document.getElementById(hash.slice(1)) : null;
    if (anchor) anchor.scrollIntoView();
    else if (region.current) region.current.scrollTop = 0;

    // Not on the first paint: the reader has not navigated anywhere, and taking
    // focus off whatever the browser gave it would be a nuisance, not an
    // announcement. `preventScroll` because the line above already decided
    // where this page opens.
    if (arrived.current) region.current?.focus({ preventScroll: true });
    arrived.current = true;
  }, [page, hash]);

  const Controls = HEADER_CONTROLS[page];

  return (
    <div className="pg-root">
      <SiteHeader page={page}>{Controls && <Controls />}</SiteHeader>

      <PageBody page={page} region={region} />
    </div>
  );
}
