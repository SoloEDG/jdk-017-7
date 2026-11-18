import type { HistoryController, OperationKind } from "../model/types";

const RANGE_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

/**
 * Wiring for native range inputs so one continuous adjustment is one operation.
 *
 * Bind the returned handlers with `v-on="gesture"` (bare event names — Vue adds
 * the `on` prefix for native elements) and call `gesture.prepare()` from the
 * component's own `input` handler before mutating the document.
 *
 * - `pointerdown` / arrow-key `keydown` open a gesture, so every `input` tick
 *   coalesces into one operation, including key auto-repeat.
 * - `pointerup` / `keyup` / `blur` / `change` close it. `change` also covers
 *   programmatic moves; `commit` is a no-op while a gesture is open, so the
 *   overlapping events never double-record.
 * - `pointercancel` aborts the gesture and restores the previous node.
 * - If the slider moves again after an abort (the pointer is still down),
 *   `prepare()` opens a fresh gesture so the rolled-back half-move is never
 *   folded into the next operation.
 */
export function useRangeGesture(
  history: HistoryController,
  label: string,
  kind: OperationKind = "projection",
) {
  let dragging = false;
  let cancelled = false;

  function open() {
    dragging = true;
    cancelled = false;
    history.beginGesture(label, kind, () => {
      cancelled = true;
      dragging = false;
    });
  }

  return {
    pointerdown(e: PointerEvent) {
      if (e.button > 0) return;
      open();
    },
    keydown(e: KeyboardEvent) {
      if (RANGE_KEYS.has(e.key) && !dragging) open();
    },
    change() {
      if (dragging) {
        dragging = false;
        history.endGesture();
        return;
      }
      if (cancelled) {
        // The aborted value was restored; don't record it again.
        cancelled = false;
        return;
      }
      history.commit(label, kind);
    },
    pointerup() {
      if (!dragging) return;
      dragging = false;
      history.endGesture();
    },
    keyup(e: KeyboardEvent) {
      if (!RANGE_KEYS.has(e.key) || !dragging) return;
      dragging = false;
      history.endGesture();
    },
    blur() {
      if (!dragging) return;
      dragging = false;
      history.endGesture();
    },
    pointercancel() {
      if (!dragging) return;
      dragging = false;
      history.cancelGesture();
    },
    /** Opens a fallback gesture for input events with no preceding pointer/key. */
    prepare() {
      if (!dragging) open();
    },
  };
}
