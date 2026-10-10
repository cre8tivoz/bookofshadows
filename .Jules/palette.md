## 2025-05-18 - Unlabelled Toolbar Search Inputs and Select Dropdowns
**Learning:** Toolbar search inputs and dropdown select filters without visible `<label>` elements rely solely on `placeholder` attributes or default option text, which screen readers often do not announce or label correctly.
**Action:** Always provide explicit `aria-label` attributes on inline toolbar `<input>` and `<select>` controls where visual design omits dedicated `<label>` tags.

## 2026-03-31 - Unlabelled List Item Selection Checkboxes
**Learning:** List item selection checkboxes wrapped in visual `<label>` tags without text content are announced as unlabelled controls by screen readers, making multi-select interactions unclear.
**Action:** Always provide an explicit `aria-label` on selection checkboxes (e.g. `aria-label="Select memory <id>"`) so screen reader users know which item is being selected.
