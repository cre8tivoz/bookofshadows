import { esc } from '../utils/escape.js';

export const $ = (s, root = document) => root.querySelector(s);

export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function fillSelect(sel, options, first) {
  const current = sel.value;
  sel.innerHTML = `<option value="">${first}</option>` + options
    .map((o) => `<option value="${esc(o.value)}">${esc(o.label)} (${o.count})</option>`)
    .join("");
  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
}

export function closeMobileMenu() {
  document.body.classList.remove("mobile-menu-open");
  const menuToggle = $("#mobileMenuToggle");
  if (menuToggle) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.textContent = "☰";
  }
}

export function closeMobileMenuForViewportChange() {
  const activeElement = document.activeElement;
  if (activeElement && activeElement.closest(".menu-search")) return;
  closeMobileMenu();
}

export function showPanel(sectionId, panelId) {
  const section = $(`#${sectionId}`);
  if (!section || !panelId) return;
  section.querySelectorAll(".subpanel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === panelId);
  });
  section.querySelectorAll(".section-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelId);
  });
}
