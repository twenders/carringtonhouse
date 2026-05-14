# Clue Bar — Design

**Date:** 2026-05-14

## Goal

Display the clue for the currently selected word in a bar directly below the puzzle grid, with previous/next navigation. Previously the viewer was strictly a companion to a printed clue sheet; this brings clues into the page itself for puzzles that include them, while leaving clueless puzzles visually unchanged.

## Scope

**In scope**
- Read `clues.Across` and `clues.Down` from the .ipuz file (standard spec format: arrays of `[number, text]` pairs).
- Render a clue bar below the grid showing the current word's clue.
- `‹` / `›` buttons at the bar's left and right edges to navigate to previous/next word, using the same semantics as the existing Tab / Shift+Tab keyboard shortcut (across-then-down, with wrap).
- Bar hidden entirely when the puzzle has no clues.
- Update `mm/example.ipuz` to include sample clues so the feature is demoed.
- Update `mm/ipuz-format.html` to document the new clue rendering (currently states clues are ignored).

**Out of scope**
- Standalone clue list view (Across/Down lists below or beside the grid).
- Editing clues in the viewer.
- Translating clue lists into entries that don't exist in the grid (mismatch handling beyond "show the clue if it matches a real entry by number").

## Data model

In `parseIpuz`, extract clues into a lookup map on the puzzle object:

```js
puzzle.clues = {
  across: { [num]: text, ... },
  down:   { [num]: text, ... },
};
puzzle.hasClues = (Object.keys(across).length + Object.keys(down).length) > 0;
```

Each clue entry from the .ipuz comes in as `[number, text]`. Non-conforming entries (missing number, non-string text) are skipped silently. `clues.Across` and `clues.Down` may be absent — treated as empty.

Display number alignment: the clue's number refers to the entry's *display label* (i.e. `cell.number` after [auto/custom label resolution](./2026-05-10-crossword-checker-design.md)). If a puzzle uses custom labels (e.g. cell labeled `10`), the matching clue is `[10, "..."]`.

## UI

New element `#clue-bar` in `index.html`, placed immediately after `#grid`. Three children:
- `<button class="clue-nav prev" aria-label="Previous clue">‹</button>`
- `<span class="clue-text"></span>`
- `<button class="clue-nav next" aria-label="Next clue">›</button>`

Styling:
- Background: `var(--active-word)` (same blue as the selected word in the grid).
- Always directly below the grid (regular block flow — not sticky).
- Width matches the grid width.
- Buttons: ≥44×44px hit area, no background, chevron glyph only.
- Clue text format: **bold** label (e.g. `1A`), small CSS gap (~0.4em), clue text in normal weight.
  - Direction suffix: `A` for across, `D` for down.
  - If the entry's clue is missing in the data but the bar is showing (puzzle does have *some* clues), show just the bold label with no trailing text.

When `puzzle.hasClues === false`, the bar is rendered with `display: none` so the layout below the grid is unchanged from today.

## Behavior

- The bar reads from current state. Any cursor or direction change re-renders the bar.
- Clicking `‹` / `›` invokes the existing `tabToWord(state, puzzle, reverse)`. No new engine logic.
- The bar's clue updates synchronously with the cursor move; `clickCell`, arrow keys, Tab, and toggleDirection all already update state and cause a re-render.

## Files touched

- `mm/engine.js` — extend `parseIpuz` to populate `puzzle.clues` and `puzzle.hasClues`. No engine logic changes beyond data extraction.
- `mm/app.js` — render and update the bar, wire button handlers.
- `mm/index.html` — add `#clue-bar` markup and CSS.
- `mm/example.ipuz` — add a small `clues` block.
- `mm/ipuz-format.html` — replace the "Clues" section with documentation of the new rendering.
- `mm/_dev/tests/engine.test.js` — tests for clue extraction and `hasClues`.

## Tests

- `parseIpuz` extracts `clues.Across` / `clues.Down` into `puzzle.clues.{across,down}` lookup maps keyed by number.
- `puzzle.hasClues` is true when either direction has any entries.
- `puzzle.hasClues` is false when `clues` is missing or both arrays are empty.
- Malformed clue entries (wrong shape) are skipped silently.

UI rendering and click handlers stay in `app.js` and aren't covered by the existing engine tests (which are DOM-free). That matches the current testing convention in this codebase.
