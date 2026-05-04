# Changelog

## 0.3.3

- Fix mobile overview stat labels being slightly clipped at the bottom by increasing label line-height and allowing visible overflow.

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
