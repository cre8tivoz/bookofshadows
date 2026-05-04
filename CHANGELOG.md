# Changelog

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
