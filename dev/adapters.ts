import { useToast } from "@batthewz/response-ui-react-components";
import { useMemo } from "react";

import type { RendererAdapters } from "../src/index";

/**
 * The host half of the contract, wired for a demo: navigation and requests are
 * announced rather than performed, so every action in a rendered document does
 * something visible without the page owning a router or a backend.
 */
export function useDemoAdapters(): RendererAdapters {
  const { toast } = useToast();
  return useMemo(
    () => ({
      navigate: (path: string) => toast(`navigate → ${path}`, { variant: "info" }),
      toast,
      fetch: (url: string, init: RequestInit) => fetch(url, init),
    }),
    [toast],
  );
}
