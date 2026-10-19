import { useCallback, useRef, type FocusEvent, type RefObject } from "react";

/**
 * For dialogs opened from something that's gone by the time they close (a menu
 * item, a table row): remember the button that started it, and send focus back
 * there instead of letting it drop to <body>.
 *
 *   const returnFocus = useReturnFocus();
 *   <Button onFocus={returnFocus.remember}>…</Button>
 *   <SomeDialog returnFocusTo={returnFocus.ref} />
 */
export function useReturnFocus() {
  const ref = useRef<HTMLElement | null>(null);
  const remember = useCallback((event: FocusEvent<HTMLElement>) => {
    ref.current = event.currentTarget;
  }, []);
  return { ref, remember };
}

/** `onCloseAutoFocus` for a Radix dialog: focus `target` when it's set, otherwise Radix's default. */
export function focusOnClose(target: RefObject<HTMLElement | null> | undefined) {
  return (event: Event) => {
    if (!target?.current) return;
    event.preventDefault();
    target.current.focus();
  };
}
