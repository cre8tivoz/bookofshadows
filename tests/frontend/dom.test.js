import { beforeEach, describe, expect, test } from "vitest";

import { $, $$, closeMobileMenu, fillSelect, showPanel } from "../../static/src/ui/dom.js";

describe("DOM helpers", () => {
  beforeEach(() => {
    document.body.className = "";
    document.body.innerHTML = "";
  });

  test("selects one or many elements from the document", () => {
    document.body.innerHTML = "<div class='item'></div><div class='item'></div>";

    expect($(".item")).toBeInstanceOf(HTMLElement);
    expect($$(".item")).toHaveLength(2);
  });

  test("fills a select and preserves current value when it remains available", () => {
    document.body.innerHTML = "<select id='source'><option value='github'>GitHub</option></select>";
    const select = $("#source");
    select.value = "github";

    fillSelect(
      select,
      [
        { value: "github", label: "GitHub", count: 3 },
        { value: "local", label: "Local", count: 1 },
      ],
      "all sources",
    );

    expect(select.value).toBe("github");
    expect(select.innerHTML).toContain("GitHub (3)");
    expect(select.innerHTML).toContain("all sources");
  });

  test("fills a select and falls back to the blank option when current value disappears", () => {
    document.body.innerHTML = "<select id='source'><option value='old'>old</option></select>";
    const select = $("#source");
    select.value = "old";

    fillSelect(select, [{ value: "new", label: "New", count: 1 }], "all sources");

    expect(select.value).toBe("");
  });

  test("shows the requested subpanel and active section tab", () => {
    document.body.innerHTML = `
      <section id="today">
        <div id="todayAdded" class="subpanel active"></div>
        <div id="todayRecalled" class="subpanel"></div>
        <div class="section-tabs">
          <button data-panel="todayAdded" class="active">Added</button>
          <button data-panel="todayRecalled">Recalled</button>
        </div>
      </section>
    `;

    showPanel("today", "todayRecalled");

    expect($("#todayAdded").classList.contains("active")).toBe(false);
    expect($("#todayRecalled").classList.contains("active")).toBe(true);
    expect($('[data-panel="todayAdded"]').classList.contains("active")).toBe(false);
    expect($('[data-panel="todayRecalled"]').classList.contains("active")).toBe(true);
  });

  test("closes the mobile menu and updates the toggle", () => {
    document.body.classList.add("mobile-menu-open");
    document.body.innerHTML = '<button id="mobileMenuToggle" aria-expanded="true">x</button>';

    closeMobileMenu();

    expect(document.body.classList.contains("mobile-menu-open")).toBe(false);
    expect($("#mobileMenuToggle").getAttribute("aria-expanded")).toBe("false");
    expect($("#mobileMenuToggle").textContent).toBe("☰");
  });
});
