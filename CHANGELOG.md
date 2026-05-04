# Changelog

## 0.4.1

- Remove the Local only sidebar badge from desktop and mobile navigation to keep the sidebar/menu focused on product navigation.

## 0.4.0

- Simplify top-level navigation from nine tabs to five product sections: Overview, Explore, Activity, Graph, and Settings.
- Fold Search, Memories, and Recall Debugger into Explore with internal segmented tabs.
- Fold Timeline and Consolidations into Activity, and Triples into Graph.
- Add Overview quick actions so users can jump directly into common workflows without exposing every raw view in the sidebar.

## 0.3.12

- Hide the duplicate sidebar theme switch from the mobile hamburger menu now that theme control is available directly in the mobile top bar.

## 0.3.11

- Add a GitHub README screenshot gallery generated from synthetic mock Mnemosyne data across desktop, mobile, dark, and light theme views.
- Add a local screenshot generator script for refreshing the mock-data gallery without reading private memory data.

## 0.3.10

- Keep mobile timeline group event-count badges inside the card by letting long session headings wrap within the available width.

## 0.3.9

- Add extra mobile header spacing around the Great Vibes “M” mark so its glyph overhang does not overlap the Mnemosyne wordmark.

## 0.3.8

- Add a compact theme toggle directly to the mobile top bar so light/dark mode is available without opening the hamburger menu.

## 0.3.7

- Treat short phone-landscape viewports as compact mobile layout so the menu stays collapsed and desktop hero/sidebar content does not dominate the screen.
- Close the mobile menu automatically on resize/orientation changes.

## 0.3.6

- Change dashboard searches from broad substring matching to token-prefix matching so terms like "Dian" no longer match inside words such as "Obsidian".

## 0.3.5

- Rename the brand subtitle from "Memory OS" to "Memory for Hermes".

## 0.3.4

- Fix mobile stat-card number descenders being clipped in light theme by giving Playfair numerals extra line-height and bottom breathing room.

## 0.3.3

- Fix mobile overview stat labels being partially obscured by the stat-card glow layer and add extra label vertical breathing room.

## 0.3.2

- Refine mobile layouts for search, timeline, graph, consolidations, settings, overview cards, and memory cards.
- Keep mobile section headings and right-aligned helper labels within the viewport.
- Normalize mobile toolbar, result panel, and card widths to prevent horizontal overflow.
- Center the relationship graph canvas on mobile after rendering.
- Fix mobile password-auth checkbox sizing and spacing.

## 0.3.1

- Add `/api/health` smoke-test endpoint.
- Add baseline security headers (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
- Harden static file serving with path resolution against `static/`.
- Make numeric query parsing resilient to malformed limits/offsets.
- Add server-level pytest coverage for health, headers, bad query params, and static path escapes.
- Add project metadata and contributor guidance for GitHub publication.
- Run Ruff in GitHub Actions.

## 0.3.0

- Local read-only dashboard for Mnemosyne working/episodic memories, triples, graph, consolidations, search, recall debugging, timeline, theme switching, and optional password auth.
