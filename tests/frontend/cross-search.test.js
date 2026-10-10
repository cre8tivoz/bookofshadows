import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  initGlobalSearch,
  loadUnifiedTimeline,
  performGlobalSearch,
  renderSearchChips,
} from "../../static/src/cross-search.js";

describe("cross-search module", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renderSearchChips creates provider buttons and toggles active state", () => {
    document.body.innerHTML = `<div id="searchProviderChips"></div>`;
    const mockProviders = {
      mnemosyne: { name: "Mnemosyne", glyph: "🧠" },
      honcho: { name: "Honcho", glyph: "🪞" },
    };

    renderSearchChips(mockProviders);

    const chips = document.querySelectorAll(".provider-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toContain("Mnemosyne");
    expect(chips[0].classList.contains("active")).toBe(true);

    // Toggle active chip
    chips[0].click();
    expect(chips[0].classList.contains("active")).toBe(false);
  });

  test("initGlobalSearch binds input keydown, input debounce, and button click handlers", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <input id="globalSearchInput" value="query" />
      <button id="globalSearchButton"></button>
      <div id="searchProviderChips"></div>
      <div id="globalSearchResults" class="hidden"></div>
    `;

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: {} }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    initGlobalSearch();

    const input = document.getElementById("globalSearchInput");
    const button = document.getElementById("globalSearchButton");

    // Enter key triggers search immediately
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("q=query"));

    // Button click triggers search
    fetchSpy.mockClear();
    button.click();
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("q=query"));

    // Debounced input triggers search after delay
    fetchSpy.mockClear();
    input.dispatchEvent(new Event("input"));
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("q=query"));

    vi.useRealTimers();
  });

  test("performGlobalSearch renders search result sections, metadata, and handles expand toggle", async () => {
    document.body.innerHTML = `
      <input id="globalSearchInput" value="hermes" />
      <div id="searchProviderChips">
        <button class="provider-chip active" data-provider="mnemosyne">Mnemosyne</button>
      </div>
      <div id="globalSearchResults" class="hidden"></div>
    `;

    const mockSearchResults = {
      results: {
        mnemosyne: {
          provider: { name: "Mnemosyne", glyph: "🧠", color: "#00f" },
          total: 1,
          rows: [
            {
              content: "Hermes agent memory",
              kind: "episodic",
              timestamp: "2026-07-01",
              veracity: "verified",
              importance: 4.5,
              metadata: { source: "test_runner" },
            },
          ],
        },
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSearchResults,
      })
    );

    await performGlobalSearch();

    const resultsContainer = document.getElementById("globalSearchResults");
    expect(resultsContainer.classList.contains("hidden")).toBe(false);
    expect(resultsContainer.innerHTML).toContain("Hermes agent memory");
    expect(resultsContainer.innerHTML).toContain("Mnemosyne");

    // Test expand metadata button toggle
    const expandBtn = resultsContainer.querySelector(".expand-btn");
    const metadataDiv = resultsContainer.querySelector(".memory-metadata");
    expect(expandBtn).not.toBeNull();
    expect(metadataDiv.classList.contains("hidden")).toBe(true);

    expandBtn.click();
    expect(metadataDiv.classList.contains("hidden")).toBe(false);
    expect(expandBtn.textContent).toBe("Hide metadata");

    expandBtn.click();
    expect(metadataDiv.classList.contains("hidden")).toBe(true);
    expect(expandBtn.textContent).toBe("Show metadata");
  });

  test("performGlobalSearch renders empty state when total results are zero", async () => {
    document.body.innerHTML = `
      <input id="globalSearchInput" value="nonexistent" />
      <div id="globalSearchResults" class="hidden"></div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: { mnemosyne: { rows: [] } } }),
      })
    );

    await performGlobalSearch();

    const resultsContainer = document.getElementById("globalSearchResults");
    expect(resultsContainer.classList.contains("hidden")).toBe(false);
    expect(resultsContainer.innerHTML).toContain("No results found.");
  });

  test("loadUnifiedTimeline renders timeline headers, filter chips, and entries", async () => {
    document.body.innerHTML = `<div id="unifiedTimeline"></div>`;

    const todayStr = new Date().toISOString().slice(0, 10);
    const mockTimelineData = {
      providers: ["mnemosyne"],
      timeline: [
        {
          provider: "mnemosyne",
          provider_name: "Mnemosyne",
          provider_glyph: "🧠",
          provider_color: "#00f",
          content: "Timeline entry content",
          kind: "episodic",
          timestamp: `${todayStr}T12:34:56Z`,
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTimelineData,
      })
    );

    await loadUnifiedTimeline();

    const container = document.getElementById("unifiedTimeline");
    expect(container.innerHTML).toContain(todayStr);
    expect(container.innerHTML).toContain("Timeline entry content");

    const entry = container.querySelector(".timeline-entry");
    expect(entry.classList.contains("today")).toBe(true);

    // Filter chip toggle
    const filterChip = container.querySelector(".timeline-filter-chip");
    expect(filterChip).not.toBeNull();

    filterChip.click();
    expect(filterChip.classList.contains("active")).toBe(false);
    expect(entry.style.display).toBe("none");

    filterChip.click();
    expect(filterChip.classList.contains("active")).toBe(true);
    expect(entry.style.display).toBe("");
  });

  test("loadUnifiedTimeline renders empty state when no timeline records exist", async () => {
    document.body.innerHTML = `<div id="unifiedTimeline"></div>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ providers: [], timeline: [] }),
      })
    );

    await loadUnifiedTimeline();

    const container = document.getElementById("unifiedTimeline");
    expect(container.innerHTML).toContain("No timeline entries found.");
  });

  test("loadUnifiedTimeline renders error banner when fetch fails", async () => {
    document.body.innerHTML = `<div id="unifiedTimeline"></div>`;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network disconnect"))
    );

    await loadUnifiedTimeline();

    const container = document.getElementById("unifiedTimeline");
    expect(container.innerHTML).toContain("Timeline load failed: Network disconnect");
  });
});
