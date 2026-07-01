# Accessibility Notes

Book of Shadows is designed for local, daily memory review, so the interface needs to be usable with keyboard, pointer, and reduced-motion preferences.

## Current Support

- Main navigation and section tabs expose `role="tablist"` / `role="tab"` and keep `aria-selected` in sync.
- The memory detail drawer, confirmation modal, and login overlay are dialogs with focus trapping and focus restoration.
- Escape closes overlays safely.
- Common non-native rows use `bindActivatable()` so Enter and Space work alongside pointer clicks.
- Global shortcuts support `/` for search, `?` for help, `Esc` for overlays, `g o`, `g m`, `g r`, and `g k` for navigation, plus `Cmd/Ctrl+K` for command search.
- `:focus-visible` styles provide a visible keyboard ring without noisy pointer focus.
- `prefers-reduced-motion` reduces CSS transitions and disables decorative auto-motion in canvas/3D visualisers while preserving interaction.
- Numeric dashboard data uses tabular numbers for easier scanning.
- Dark and light theme text colors were tuned after a contrast pass; subtle text remains decorative or redundant-label text only.

## Known Limitations

- Canvas and WebGL visualisers are still primarily pointer-driven. The Knowledge Graph table and memory list provide keyboard-accessible alternatives for the same underlying data.
- Some dense operational screens remain information-heavy on small devices, though the mobile shell and core review/search flows are usable.
- This project does not currently run automated axe or screen-reader regression checks; accessibility coverage is unit-tested around focus utilities and interaction helpers, then verified through browser smoke/manual checks.

## Manual Check Before Release

1. Tab through Overview, Memories, Review, Graph, Insights, and Settings.
2. Open and close the memory detail drawer using keyboard only.
3. Confirm focus returns to the triggering item after drawer/modal close.
4. Toggle reduced motion at the OS/browser level and open Visualiser plus Visualiser 3D.
5. Check dark and light themes for readable labels, chart text, and form controls.
6. Verify mobile width does not introduce horizontal scrolling in core flows.
