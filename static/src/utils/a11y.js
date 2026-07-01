const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function focusableElements(container) {
  if (!container) return [];
  return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute("hidden") && !el.closest(".hidden")
  );
}

export function trapFocus(container) {
  const trigger = document.activeElement;
  const onKeydown = (event) => {
    if (event.key !== "Tab") return;
    const focusable = focusableElements(container);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    } else if (!container.contains(current)) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener("keydown", onKeydown);
  return function releaseFocusTrap({ restoreFocus = true } = {}) {
    container.removeEventListener("keydown", onKeydown);
    if (restoreFocus && trigger && document.contains(trigger) && typeof trigger.focus === "function") {
      trigger.focus();
    }
  };
}
