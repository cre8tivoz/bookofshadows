## 2025-05-18 - Unlabelled Toolbar Search Inputs and Select Dropdowns
**Learning:** Toolbar search inputs and dropdown select filters without visible `<label>` elements rely solely on `placeholder` attributes or default option text, which screen readers often do not announce or label correctly.
**Action:** Always provide explicit `aria-label` attributes on inline toolbar `<input>` and `<select>` controls where visual design omits dedicated `<label>` tags.
