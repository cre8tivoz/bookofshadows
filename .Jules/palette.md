## 2025-05-18 - Unlabelled Toolbar Search Inputs and Select Dropdowns
**Learning:** Toolbar search inputs and dropdown select filters without visible `<label>` elements rely solely on `placeholder` attributes or default option text, which screen readers often do not announce or label correctly.
**Action:** Always provide explicit `aria-label` attributes on inline toolbar `<input>` and `<select>` controls where visual design omits dedicated `<label>` tags.

## 2026-03-31 - Unlabelled List Item Selection Checkboxes
**Learning:** List item selection checkboxes wrapped in visual `<label>` tags without text content are announced as unlabelled controls by screen readers, making multi-select interactions unclear.
**Action:** Always provide an explicit `aria-label` on selection checkboxes (e.g. `aria-label="Select memory <id>"`) so screen reader users know which item is being selected.

## 2026-05-20 - Delegated Session Pill Click Selectors and Toggle ARIA Labels
**Learning:** Chip button components generated in item lists must include delegation CSS class names (like `.session-link`) expected by event listeners in parent controllers; otherwise click events fall through to card containers. Additionally, mobile toggle buttons changing icon text (e.g., '☰' to '×') must update `aria-label` dynamically to reflect 'Open menu' vs 'Close menu'.
**Action:** Always include delegation classes on rendered sub-button chips and dynamically toggle `aria-label` when interactive icon toggle states change.
