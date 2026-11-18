import type { HistoryController } from "../model/types";

function isTextEditing(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable ||
    (el.tagName === "INPUT" &&
      !["range", "checkbox", "color", "radio", "button"].includes(
        (el as HTMLInputElement).type,
      ))
  );
}

/**
 * Global undo/redo shortcuts. Sliders, checkboxes and color pickers keep undo
 * available while focused; text entry and selects keep their native handling.
 */
export function bindHistoryShortcuts(history: HistoryController) {
  function onKey(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key !== "z" && key !== "y") return;
    if (isTextEditing(e.target)) return;
    e.preventDefault();
    if (key === "y" || (key === "z" && e.shiftKey)) history.redo();
    else history.undo();
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
