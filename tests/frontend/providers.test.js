import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  bootstrapProviderShell,
  getProviderHealth,
  getProviders,
  getSelectedProvider,
  hideEmptyState,
  hideErrorBanner,
  hideLoadingSkeleton,
  loadProviderContent,
  onProviderSelect,
  renderProviderTabs,
  renderSidebar,
  selectProvider,
  setDefaultProvider,
  showEmptyState,
  showErrorBanner,
  showLoadingSkeleton,
} from "../../static/src/providers.js";

describe("providers module", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("getProviders, getSelectedProvider, getProviderHealth baseline state", () => {
    expect(getProviders()).toEqual({});
    expect(getSelectedProvider()).toBeNull();
    expect(getProviderHealth("unknown")).toEqual({ status: "unknown", message: "Unknown" });
  });

  test("setDefaultProvider updates localStorage and DOM star icons", () => {
    document.body.innerHTML = `
      <span class="star" data-slug="mnemosyne">☆</span>
      <span class="star" data-slug="mempalace">☆</span>
    `;

    setDefaultProvider("mnemosyne");

    expect(localStorage.getItem("bos.default_provider")).toBe("mnemosyne");
    const stars = document.querySelectorAll(".star");
    expect(stars[0].textContent).toBe("★");
    expect(stars[1].textContent).toBe("☆");
  });

  test("renderProviderTabs renders buttons and handles clicks", () => {
    document.body.innerHTML = `<div id="providerTabs"></div>`;
    const mockProviders = {
      mnemosyne: { name: "Mnemosyne", color: "#00f", glyph: "🧠" },
      honcho: { name: "Honcho", color: "#f00", glyph: "🪞" },
    };

    renderProviderTabs(mockProviders);

    expect(getProviders()).toEqual(mockProviders);
    const tabs = document.querySelectorAll(".provider-tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0].textContent).toContain("Mnemosyne");
    expect(tabs[1].textContent).toContain("Honcho");

    // Click star button on tab
    const star = tabs[0].querySelector(".star");
    star.click();
    expect(localStorage.getItem("bos.default_provider")).toBe("mnemosyne");

    // Click tab itself
    tabs[1].click();
    expect(getSelectedProvider()).toBe("honcho");
  });

  test("renderSidebar renders provider cards with status", () => {
    document.body.innerHTML = `<div id="providerSidebar"></div>`;
    const mockProviders = {
      mnemosyne: { name: "Mnemosyne", color: "#00f", glyph: "🧠" },
    };
    const mockHealth = {
      mnemosyne: { status: "healthy", message: "OK", row_count: 42 },
    };

    renderSidebar(mockProviders, mockHealth);

    expect(getProviderHealth("mnemosyne")).toEqual({ status: "healthy", message: "OK", row_count: 42 });
    const card = document.querySelector(".provider-card");
    expect(card).not.toBeNull();
    expect(card.className).toContain("status-healthy");
    expect(card.textContent).toContain("Mnemosyne");
    expect(card.textContent).toContain("OK");
    expect(card.textContent).toContain("42 memories");
  });

  test("selectProvider toggles capabilities and notifies callbacks", () => {
    document.body.innerHTML = `
      <div class="provider-tab" data-provider="mnemosyne"></div>
      <div class="provider-tab" data-provider="honcho"></div>
      <div id="tab-constellation"></div>
      <div id="tab-neural"></div>
      <div data-visualiser="peer" class="nav-hidden"></div>
    `;

    const mockProviders = {
      mnemosyne: { name: "Mnemosyne", capabilities: { graph: true } },
      honcho: { name: "Honcho", capabilities: { graph: false } },
    };

    renderProviderTabs(mockProviders);

    let selectedArgs = null;
    onProviderSelect((slug, info) => {
      selectedArgs = { slug, info };
    });

    selectProvider("mnemosyne");

    expect(getSelectedProvider()).toBe("mnemosyne");
    expect(localStorage.getItem("bos.last_selected_provider")).toBe("mnemosyne");
    expect(selectedArgs).toEqual({ slug: "mnemosyne", info: mockProviders.mnemosyne });

    const tabConstellation = document.getElementById("tab-constellation");
    expect(tabConstellation.classList.contains("hidden")).toBe(false);

    // Switch to honcho
    localStorage.setItem("mnemosyne-dashboard-visualiser-mode", "peer");
    selectProvider("honcho");

    expect(getSelectedProvider()).toBe("honcho");
    expect(tabConstellation.classList.contains("hidden")).toBe(true);

    const peerTab = document.querySelector('[data-visualiser="peer"]');
    expect(peerTab.classList.contains("nav-hidden")).toBe(false);

    // Switch away from honcho while in peer mode resets mode
    selectProvider("mnemosyne");
    expect(localStorage.getItem("mnemosyne-dashboard-visualiser-mode")).toBe("constellation");
  });

  test("empty state, loading skeleton, and error banner helpers", () => {
    document.body.innerHTML = `
      <div id="emptyState" class="hidden"></div>
      <div id="loadingSkeleton" class="hidden"></div>
      <div id="errorBanner" class="hidden"><span id="errorText"></span><button id="retryBtn"></button></div>
      <div id="contentArea"></div>
    `;

    showEmptyState("Test Provider", "Custom reason");
    expect(document.getElementById("emptyState").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("emptyState").textContent).toContain("Test Provider");
    expect(document.getElementById("contentArea").classList.contains("hidden")).toBe(true);

    hideEmptyState();
    expect(document.getElementById("emptyState").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("contentArea").classList.contains("hidden")).toBe(false);

    showLoadingSkeleton();
    expect(document.getElementById("loadingSkeleton").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("contentArea").classList.contains("hidden")).toBe(true);

    hideLoadingSkeleton();
    expect(document.getElementById("loadingSkeleton").classList.contains("hidden")).toBe(true);

    let retried = false;
    showErrorBanner("Error msg", () => { retried = true; });
    expect(document.getElementById("errorBanner").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("errorText").textContent).toBe("Error msg");

    document.getElementById("retryBtn").click();
    expect(retried).toBe(true);

    hideErrorBanner();
    expect(document.getElementById("errorBanner").classList.contains("hidden")).toBe(true);
  });

  test("loadProviderContent fetches memories and renders content or empty state", async () => {
    document.body.innerHTML = `
      <div id="emptyState" class="hidden"></div>
      <div id="loadingSkeleton" class="hidden"></div>
      <div id="errorBanner" class="hidden"><span id="errorText"></span><button id="retryBtn"></button></div>
      <div id="contentArea"></div>
    `;

    // Success with memories
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          memories: [{ content: "Memory 1", kind: "episodic", timestamp: "2026-07-01" }],
        }),
      })
    );

    await loadProviderContent("mnemosyne");
    expect(document.getElementById("contentArea").innerHTML).toContain("Memory 1");

    // Success with empty memories
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ memories: [] }),
      })
    );

    await loadProviderContent("mnemosyne");
    expect(document.getElementById("emptyState").classList.contains("hidden")).toBe(false);

    // Error scenario
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    await loadProviderContent("mnemosyne");
    expect(document.getElementById("errorBanner").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("errorText").textContent).toContain("HTTP 500");
  });

  test("bootstrapProviderShell initializes registry, tabs, sidebar, and selects default", async () => {
    document.body.innerHTML = `
      <div id="providerTabs"></div>
      <div id="providerSidebar"></div>
      <div id="emptyState" class="hidden"></div>
    `;

    const mockProviders = {
      mnemosyne: { name: "Mnemosyne", color: "#00f", glyph: "🧠" },
    };
    const mockHealth = {
      providers: { mnemosyne: { status: "healthy", message: "OK", row_count: 5 } },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn((url) => {
        if (url === "/api/providers") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ providers: mockProviders }),
          });
        }
        if (url === "/api/health") {
          return Promise.resolve({
            ok: true,
            json: async () => mockHealth,
          });
        }
        return Promise.reject(new Error("unknown url"));
      })
    );

    await bootstrapProviderShell();

    expect(getProviders()).toEqual(mockProviders);
    expect(getSelectedProvider()).toBe("mnemosyne");
    expect(document.querySelectorAll(".provider-tab")).toHaveLength(1);
    expect(document.querySelectorAll(".provider-card")).toHaveLength(1);
  });
});
