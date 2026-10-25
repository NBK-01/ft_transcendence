import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in sync as the window changes. For when
 * CSS alone can't switch (a popover on wide screens, a sheet on phones);
 * otherwise prefer Tailwind's breakpoints. Tailwind's md is "(min-width: 48rem)".
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}
