# Crossword Checker — Design

**Date:** 2026-05-10
**Author:** Carrington House
**Puzzle:** *Across the Solar System (and down)* — May 2026

## Goal

A small, hostable web page that lets a solver fill in the *Across the Solar System (and down)* crossword (and future puzzles) on a phone or computer, see whether their letters are right, save progress automatically, and not see anyone else's progress. The page is a **companion** to a separately-distributed printed clue sheet — clues are not shown on the page itself.

## Scope

**In scope**
- One page that loads a puzzle from a standard `.ipuz` file and presents an interactive grid.
- Type to fill, auto-advance, space to toggle direction, arrow/tab navigation, mobile-friendly input.
- Hybrid correctness feedback: a sticky "Auto-check" toggle plus a one-shot "Check" button.
- Reveal actions: letter, word, puzzle (revealed cells lock).
- Clear button (with confirmation).
- Completion celebration when the grid is fully and correctly filled by the solver.
- Per-browser progress saved to `localStorage`, isolated per puzzle.

**Out of scope**
- No clues displayed on-page (companion to a paper sheet).
- No backend, no accounts, no analytics, no shared progress between devices/browsers.
- No timer, no leaderboard, no hint system beyond the Reveal actions.
- No `file://` support (page assumes HTTP hosting).

## Architecture

### Files

Two files, deployed together to a static host:

- `crossword.html` — the **generic engine**. Plain HTML with inline `<style>` and `<script>`. Vanilla ES2020 JavaScript. No framework, no build step, no external dependencies (no fonts, no CDN, no analytics).
- `puzzle.ipuz` — the **puzzle data** in standard [.ipuz format](http://www.ipuz.org/) (plain JSON). Sits next to the HTML. To publish a new puzzle, drop in a different `.ipuz` file (or use the `?p=` URL override, see below).

### Loading

On page load, JS does `fetch('./puzzle.ipuz')`, parses, and builds the internal puzzle model. A `?p=<filename>` query parameter overrides the default path, so one engine file can serve multiple puzzles from the same host.

`fetch` requires HTTP hosting; the page will not work when opened directly via `file://`. This is an accepted constraint.

### Persistence

`localStorage` under a per-puzzle key derived from the puzzle's identity:

- Key format: `xword:<id>` (e.g. `xword:planets-v1`).
- The `<id>` is taken from a top-level `id` field added to the `.ipuz` file (custom extension; ignored by other tools). If absent, fall back to a deterministic hash of the puzzle's title + solution string.
- Saves are debounced ~150 ms after the last keystroke.
- On load, if the saved state's grid dimensions don't match the loaded puzzle (e.g. someone replaced the `.ipuz`), the saved state is discarded and a fresh state is started.
- `localStorage` quota errors are caught and ignored (the page continues to work in-memory). At this puzzle's data size (well under 5 KB) this should never trigger in practice.

Per-user isolation is achieved purely by browser storage scoping — no auth, no shared state, no cross-user visibility by construction.

## Data model

### Internal puzzle model (built once at load time, immutable thereafter)

```
{
  rows: 15,
  cols: 15,
  id: "planets-v1",
  title: "Across the Solar System (and down)",
  cells: Cell[rows][cols],
  numbering: {
    acrossStarts: [{ num, r, c, len }, ...],
    downStarts:   [{ num, r, c, len }, ...]
  }
}

Cell = {
  isBlock:    boolean,
  solution:   "A".."Z" | null,    // null for blocks
  number:     integer | null,     // shown in cell corner if assigned
  acrossWord: <ref to entry in numbering.acrossStarts> | null,
  downWord:   <ref to entry in numbering.downStarts>   | null,
}
```

Cell numbering uses a slightly non-standard rule: this puzzle includes single-letter "entries" (a white cell flanked by blocks/edges on both sides horizontally, but vertically part of a longer word) as numbered clues. The rule the engine implements is:

- A white cell **starts an across entry** iff there is no white cell immediately to its left (i.e. block or edge to its left). The entry's length is the run of white cells to the right (≥ 1).
- A white cell **starts a down entry** iff there is no white cell directly above (block or edge above). Length is the run of white cells below (≥ 1).
- A cell is numbered iff it starts at least one entry (across or down). Numbers run left-to-right, top-to-bottom, starting at 1.

For standard crosswords (minimum word length 2 or 3), no white cell is isolated in either direction, so this rule produces identical numbering to the standard rule. For *Across the Solar System (and down)*, four cells are horizontally-isolated 1-letter entries (clues 21, 24, 58, 61 in the printed sheet) and get numbered accordingly.

A consequence of this rule: every white cell is part of an across entry *and* a down entry (each potentially length 1). The engine relies on this — `cell.acrossWord` and `cell.downWord` are always non-null on white cells.

### Solver state (mutable; the only thing persisted)

```
{
  entries:    { "r,c": "M", ... },  // sparse; uppercase letter per filled cell
  locked:     { "r,c": true, ... }, // cells filled by Reveal
  cursor:     { r, c },
  direction:  "across" | "down",
  autoCheck:  boolean,
  solvedAt:   ISO-8601 string | null
}
```

## UX & input behavior

### Grid rendering
- CSS Grid layout, one `<div class="cell">` per square.
- Block cells get `.block` (solid black, no children).
- White cells contain a small corner number (when assigned) and a centered letter span.
- The active cell is highlighted; the rest of the active word (across or down per `direction`) gets a softer "current entry" highlight. A tiny direction arrow appears on the active cell.

### Keyboard (desktop)
- **A–Z** (case-insensitive): write to the active cell, advance to the next white cell in the current direction. At the end of a word, stop on the last cell — no auto-jump to the next word.
- **Space**: toggle direction. Stay on the current cell.
- **Backspace**: if the active cell is empty, move back one cell in the current direction and clear that cell; otherwise clear the active cell and stay.
- **Arrow keys**: move one white cell in that direction (skipping blocks). Pressing an arrow perpendicular to the current direction also flips direction.
- **Tab / Shift-Tab**: jump to the first cell of the next / previous word (across, then down, then wrap).
- **Enter**: no-op (defensive, in case the page is ever embedded in a form context).

### Pointer (mouse / touch)
- Tapping a cell focuses it.
- Tapping the *already-focused* cell toggles direction (the standard mobile equivalent of pressing space).

### Mobile keyboard
A single off-screen hidden `<input>` element receives the on-screen keyboard's events. Attributes:
- `inputmode="text"`
- `autocapitalize="characters"`
- `autocomplete="off"`
- `autocorrect="off"`
- `spellcheck="false"`
- `font-size: 16px` (prevents iOS auto-zoom on focus)

The visible grid is purely display; tapping any cell focuses the hidden input, which raises the keyboard. Key events are handled by the same handler used for desktop.

### Toolbar
A compact row of controls, positioned above the grid on desktop and below on mobile (whichever leaves the grid visible above the keyboard):

- **Auto-check** toggle (sticky setting, persisted in solver state).
- **Check** button — one-shot correctness highlight when Auto-check is off. No-op when Auto-check is on.
- **Reveal ▾** dropdown with Letter / Word / Puzzle.
- **Clear** button (with a confirm dialog).

### Locked cells
Cells filled by any Reveal action are styled distinctly (e.g. blue letter color) and refuse further edits — typing while focused on a locked cell does nothing (matches standard crossword convention so a revealed letter cannot be accidentally overwritten).

### Wrong-letter display
A white cell whose entry doesn't match the solution is rendered with red letter color and a small red corner triangle when its "wrong" mark is active. Mark lifecycle:
- **Auto-check on**: marks are always live — a wrong letter shows the mark immediately on the keystroke that creates it; correcting the letter clears the mark on that keystroke.
- **Auto-check off**: marks appear when the user presses **Check**, and persist until that cell is next edited (any keystroke on the cell clears its mark, whether or not the new letter is correct). Toggling Auto-check off does not clear marks shown by a previous Check; toggling Auto-check on takes over and re-derives marks from current state.

### Completion
`isSolved()` runs after every state change. The celebration fires (and `solvedAt` is set to the current ISO timestamp) **only** when `isSolved()` transitions from false → true *as a result of a user keystroke* — not as a result of a Reveal action. In practice: only the keystroke handler checks for solve and triggers the overlay; Reveal handlers update state but do not check.

The "Solved!" overlay fades in, is dismissable (tapping outside, pressing Esc, or pressing a Close button), and after dismissal the grid remains visible and editable for review.

## Check logic

- `isCorrect(r, c)` ≡ `entries[r,c] === cells[r][c].solution`.
- `wrongCells()` ≡ white cells where `entries[r,c]` is non-empty and not equal to `solution`.
- `isSolved()` ≡ every white cell has `entries[r,c] === solution`.

## Reveal actions

- **Reveal Letter**: write the solution into the active cell; set `locked[r,c] = true`.
- **Reveal Word**: as Reveal Letter, but for every cell of the active word (the across or down entry the cursor sits on, depending on `direction`).
- **Reveal Puzzle**: as Reveal Letter, applied to every white cell. Does not set `solvedAt`.

## Clear

Show a confirm dialog ("Clear all your progress?"). On confirm:
- `entries = {}`
- `locked = {}`
- `solvedAt = null`

`cursor`, `direction`, and `autoCheck` are preserved.

## Puzzle file

The `puzzle.ipuz` is generated for *Across the Solar System (and down)* using:

- Title: `Across the Solar System (and down)`
- Author: `Carrington House`
- Copyright / date: `© 2026` (May 2026)
- Custom field: `id: "planets-v1"` (used for the localStorage key)
- Grid: 15 × 15, derived from the canonical grid the user provided in conversation. Block cells are encoded with the standard `.ipuz` `block` value (`"#"`); white cells carry the solution letter.
- Numbering: omitted from the file (the engine computes it from the grid at load time, which is more robust than trusting an authored numbering).
- Clues: empty arrays (the page does not display clues, but keeping the keys present makes the file valid `.ipuz` and easy to extend later).

The actual grid characters will be supplied at implementation time from the original message in the brainstorming conversation, not from any local file.

## Visual style

- Plain, neutral, high-contrast: white grid, black blocks, dark text on white cells.
- Active cell highlight: pale yellow. Active word highlight: pale blue.
- Wrong-letter color: red. Locked / revealed letter color: blue.
- Single system font stack (no web fonts).
- Responsive: grid scales to viewport width on mobile (square cells, computed from `min(100vw, 100vh - toolbar)`).
- Light mode only for v1 (dark mode out of scope).

## Non-goals / explicitly deferred

- Multiple puzzles selectable from a menu (the `?p=` override is the only multi-puzzle path).
- Sharing or social features.
- Server-side anything.
- Accessibility audit beyond keyboard navigation and visible focus (basic keyboard a11y is in scope; full screen-reader support is not).
- Internationalization.
