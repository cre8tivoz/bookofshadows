import { esc } from "../utils/escape.js";

export function renderToast({ tone = "info", title, body = "", actionLabel = "" }) {
  return `<div class="toast toast-${esc(tone)}" role="status">
    <strong>${esc(title || "Notice")}</strong>
    ${body ? `<p>${esc(body)}</p>` : ""}
    ${actionLabel ? `<button type="button" class="toast-action">${esc(actionLabel)}</button>` : ""}
  </div>`;
}

export function actionSummary(verb, { count = 0, failed = 0 } = {}) {
  const total = Number(count || 0);
  const failures = Number(failed || 0);
  const succeeded = Math.max(0, total - failures);
  const noun = total === 1 ? "item" : "items";
  if (failures > 0) {
    const failedNoun = failures === 1 ? "failed" : "failed";
    return `${verb} ${succeeded} of ${total} ${noun}. ${failures} ${failedNoun}.`;
  }
  return `${verb} ${total} ${noun}.`;
}

export function setButtonPending(button, pending, pendingLabel = "Working...") {
  if (!button) return;
  if (pending) {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent || "";
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = pendingLabel;
    return;
  }
  button.disabled = false;
  button.removeAttribute("aria-busy");
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

export function keyboardActionForEvent(event, chord = "") {
  const key = event.key;
  const target = event.target;
  const tag = String(target?.tagName || "").toLowerCase();
  const editable = target?.isContentEditable || ["input", "select", "textarea"].includes(tag);

  if (key === "Escape") return "close-overlay";
  if (editable) return "";
  if (key === "/") return "focus-search";
  if (key === "?" || (key === "/" && event.shiftKey)) return "show-shortcuts";
  if (chord === "g") {
    const map = { o: "go-overview", m: "go-memories", r: "go-review", k: "go-graph" };
    return map[String(key || "").toLowerCase()] || "";
  }
  if (String(key || "").toLowerCase() === "g") return "start-go-chord";
  if ((event.metaKey || event.ctrlKey) && String(key || "").toLowerCase() === "k") return "open-command";
  return "";
}

export function skeletonHtml(title = "Loading", rows = 3) {
  const count = Math.max(1, Number(rows || 1));
  const lines = Array.from({ length: count }, (_, index) => `<span class="skeleton-line skeleton-line-${index + 1}"></span>`).join("");
  return `<div class="state-card state-skeleton" aria-busy="true">
    <strong>${esc(title)}</strong>
    <div class="skeleton-lines">${lines}</div>
  </div>`;
}
