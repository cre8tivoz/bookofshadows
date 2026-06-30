export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

export function shortId(value, head = 8, tail = 6) {
  const s = String(value || "").trim();
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

export function cleanContent(content) {
  return String(content || "").replace(/^\[(USER|ASSISTANT|SYSTEM)\]\s*/i, "");
}

export function roleOf(content) {
  const m = String(content || "").match(/^\[(USER|ASSISTANT|SYSTEM)\]/i);
  return m ? m[1].toLowerCase() : "";
}
