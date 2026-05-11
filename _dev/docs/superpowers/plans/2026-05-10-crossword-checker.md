# Crossword Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hostable, mobile-friendly web page that lets a solver fill in a `.ipuz`-format crossword, see correctness feedback, save progress per browser, and reveal/clear when stuck. Engine is generic; the puzzle is a separate `.ipuz` file. Reusable across future puzzles.

**Architecture:** Three deployable files at the project root: `crossword.html` (markup + inline CSS + module bootstrap), `engine.js` (pure logic — parsing, numbering, state ops, check, persistence), `app.js` (DOM rendering, event handling, glue), plus `puzzle.ipuz` (puzzle data). No build step, no runtime dependencies. Engine logic is fully unit-tested with Node's built-in test runner via ES modules; the UI layer is verified by a manual smoke-test checklist at the end.

**Tech Stack:** Vanilla ES2020 JavaScript (ES modules, browser-native), HTML5, CSS Grid, `localStorage`, `node:test` for unit tests.

---

## File Structure

Files created by this plan, with their responsibilities:

- `crossword.html` — page markup, inline `<style>`, single `<script type="module" src="./app.js">`. No JS logic in the HTML.
- `engine.js` — exports pure functions: `parseIpuz`, `computeNumbering`, `createInitialState`, `typeLetter`, `backspace`, `moveCursor`, `toggleDirection`, `tabToWord`, `clickCell`, `setAutoCheck`, `revealLetter`, `revealWord`, `revealPuzzle`, `clearAll`, `isCorrect`, `wrongCells`, `isSolved`, `saveState`, `loadState`. No DOM, no globals beyond `localStorage` (which is injectable for tests).
- `app.js` — the DOM layer. Imports from `engine.js`. Handles: rendering the grid, mounting the hidden input, routing key/pointer events, debouncing saves, showing the completion overlay, wiring toolbar buttons. No logic beyond UI mechanics.
- `puzzle.ipuz` — the puzzle data, generated from the canonical grid + answer key the user provides.
- `package.json` — `{ "type": "module" }` plus a `test` script. No dependencies.
- `.gitignore` — minimal (node_modules, .DS_Store).
- `tests/engine.test.js` — single test file using `node:test` and `node:assert`. Covers every exported function in `engine.js`.

Deployables (the four files copied to the user's web host): `crossword.html`, `engine.js`, `app.js`, `puzzle.ipuz`.

---

## Task 1: Repo skeleton and project scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tests/engine.test.js` (empty test placeholder)
- Create: `engine.js` (empty module placeholder)
- Init: git repo

- [ ] **Step 1: Initialize git repo (if not already one)**

Run:
```bash
git init
```

Expected: `Initialized empty Git repository in ...`

- [ ] **Step 2: Create `package.json`**

Write `package.json`:
```json
{
  "name": "crossword-checker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

(The glob form is required: Node 24 stopped treating a bare directory argument to `--test` as a recursive search and now tries to import it as a module.)

- [ ] **Step 3: Create `.gitignore`**

Write `.gitignore`:
```
.DS_Store
node_modules/
*.log
```

- [ ] **Step 4: Create empty `engine.js`**

Write `engine.js`:
```js
// Crossword engine — pure logic, no DOM.
// Exports are added task by task.
```

- [ ] **Step 5: Create skeletal `tests/engine.test.js`**

Write `tests/engine.test.js`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('engine module loads', async () => {
  const engine = await import('../engine.js');
  assert.equal(typeof engine, 'object');
});
```

- [ ] **Step 6: Run tests to verify scaffolding**

Run: `npm test`
Expected: 1 test passes (`engine module loads`).

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore engine.js tests/engine.test.js
git commit -m "chore: initialize project scaffolding"
```

---

## Task 2: `parseIpuz` — parse and validate a `.ipuz` JSON object into the engine's puzzle model

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

**Context:** `.ipuz` is JSON with this shape (only the fields we care about):
```json
{
  "kind": ["http://ipuz.org/crossword#1"],
  "dimensions": { "width": 15, "height": 15 },
  "puzzle": [[1,2,...,"#"], ...],   // 2D array; "#" or block char = block; otherwise the entry's number or 0 for "in-word but not numbered"
  "solution": [["M","E",...,"#"], ...],
  "block": "#",                      // optional, defaults to "#"
  "title": "...",
  "author": "...",
  "id": "planets-v1"                 // custom field we add
}
```

The engine ignores authored numbering in `puzzle` and recomputes from blocks (more robust). It only uses `puzzle` to determine which cells are blocks. `solution` carries the answer letters. The `id` field, if present, is used for the localStorage key; otherwise we synthesize one.

`parseIpuz` returns:
```
{ rows, cols, id, title, cells, numbering }
```
where `cells[r][c] = { isBlock, solution, number, acrossWord, downWord }` and `numbering = { acrossStarts: [...], downStarts: [...] }`. The `number`, `acrossWord`, `downWord` fields are filled in by `computeNumbering` (next task) — `parseIpuz` produces a partial model and calls `computeNumbering` to finish.

For this task we'll first stub `computeNumbering` so the model is complete; the real numbering logic comes in Task 3.

- [ ] **Step 1: Write the failing test**

Append to `tests/engine.test.js`:
```js
import { parseIpuz } from '../engine.js';

const tinyIpuz = {
  kind: ['http://ipuz.org/crossword#1'],
  dimensions: { width: 3, height: 3 },
  puzzle: [
    [1, 0, 2],
    [0, '#', 0],
    [3, 0, 0],
  ],
  solution: [
    ['A', 'B', 'C'],
    ['D', '#', 'E'],
    ['F', 'G', 'H'],
  ],
  block: '#',
  title: 'Tiny',
  id: 'tiny-1',
};

test('parseIpuz extracts dimensions, id, title, and cell solutions/blocks', () => {
  const p = parseIpuz(tinyIpuz);
  assert.equal(p.rows, 3);
  assert.equal(p.cols, 3);
  assert.equal(p.id, 'tiny-1');
  assert.equal(p.title, 'Tiny');
  assert.equal(p.cells[0][0].isBlock, false);
  assert.equal(p.cells[0][0].solution, 'A');
  assert.equal(p.cells[1][1].isBlock, true);
  assert.equal(p.cells[1][1].solution, null);
});

test('parseIpuz uppercases solution letters', () => {
  const lower = { ...tinyIpuz, solution: tinyIpuz.solution.map(row => row.map(c => c === '#' ? '#' : c.toLowerCase())) };
  const p = parseIpuz(lower);
  assert.equal(p.cells[0][0].solution, 'A');
});

test('parseIpuz synthesizes an id when none provided', () => {
  const noId = { ...tinyIpuz };
  delete noId.id;
  const p = parseIpuz(noId);
  assert.match(p.id, /^x-[a-z0-9]+$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: failures saying `parseIpuz` is not exported.

- [ ] **Step 3: Implement `parseIpuz` (with a stub `computeNumbering`)**

Append to `engine.js`:
```js
export function parseIpuz(ipuz) {
  const rows = ipuz.dimensions.height;
  const cols = ipuz.dimensions.width;
  const blockChar = ipuz.block ?? '#';
  const cells = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const sol = ipuz.solution[r][c];
      const isBlock = sol === blockChar || ipuz.puzzle[r][c] === blockChar;
      row.push({
        isBlock,
        solution: isBlock ? null : String(sol).toUpperCase(),
        number: null,
        acrossWord: null,
        downWord: null,
      });
    }
    cells.push(row);
  }
  const id = ipuz.id ?? synthesizeId(ipuz);
  const puzzle = {
    rows, cols, id,
    title: ipuz.title ?? '',
    cells,
    numbering: { acrossStarts: [], downStarts: [] },
  };
  computeNumbering(puzzle);
  return puzzle;
}

function synthesizeId(ipuz) {
  const seed = (ipuz.title ?? '') + '|' + JSON.stringify(ipuz.solution);
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 'x-' + (h >>> 0).toString(36);
}

// Stub — real logic implemented in Task 3.
export function computeNumbering(puzzle) {
  // No-op for now.
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all three new tests pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): parseIpuz extracts dimensions, blocks, solutions, id"
```

---

## Task 3: `computeNumbering` — assign cell numbers and link cells to their across/down word entries

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

**Algorithm:** This puzzle uses a non-standard rule that includes single-letter entries — see the spec for context. Concretely:

- Iterate cells row-major.
- A white cell **starts an across entry** iff there is no white cell immediately to its left (block or edge to left). Entry length is the run of white cells to the right, ≥ 1.
- A white cell **starts a down entry** iff there is no white cell directly above (block or edge above). Length is the run of white cells below, ≥ 1.
- A cell gets the next sequential number iff it starts at least one entry.
- Walk right (or down) from each start to determine `len`, and link every cell in that span to the entry via `acrossWord` / `downWord`.
- A consequence of this rule: every white cell ends up part of *both* an across entry and a down entry. `cell.acrossWord` / `cell.downWord` are never null for white cells.

For *Across the Solar System (and down)* this produces numbering that matches the printed sheet (max #74 across, #68 down). In the test fixture below (the same `tinyIpuz` from Task 2), it produces 1-letter entries 2D, 4A, 5A, 7D alongside the 3-letter 1A/6A/1D/3D.

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
test('computeNumbering numbers every cell that starts an entry, including 1-letter entries', () => {
  const p = parseIpuz(tinyIpuz);
  // Tiny grid:
  //  A B C
  //  D # E
  //  F G H
  // Numbering with the rule "no white to left → starts across; no white above → starts down":
  //  (0,0)=1  (1A=ABC, 1D=ADF)
  //  (0,1)=2  (2D=B, 1-letter — block at (1,1))
  //  (0,2)=3  (3D=CEH)
  //  (1,0)=4  (4A=D, 1-letter — block at (1,1))
  //  (1,2)=5  (5A=E, 1-letter — edge to right)
  //  (2,0)=6  (6A=FGH)
  //  (2,1)=7  (7D=G, 1-letter — block above, edge below)
  //  (2,2) is unnumbered (white above and to left)
  assert.equal(p.cells[0][0].number, 1);
  assert.equal(p.cells[0][1].number, 2);
  assert.equal(p.cells[0][2].number, 3);
  assert.equal(p.cells[1][0].number, 4);
  assert.equal(p.cells[1][2].number, 5);
  assert.equal(p.cells[2][0].number, 6);
  assert.equal(p.cells[2][1].number, 7);
  assert.equal(p.cells[2][2].number, null);
});

test('computeNumbering links across-word membership; every white cell has an acrossWord', () => {
  const p = parseIpuz(tinyIpuz);
  assert.equal(p.cells[0][0].acrossWord.num, 1);
  assert.equal(p.cells[0][1].acrossWord.num, 1);
  assert.equal(p.cells[0][2].acrossWord.num, 1);
  assert.equal(p.cells[1][0].acrossWord.num, 4); // D, 1-letter
  assert.equal(p.cells[1][2].acrossWord.num, 5); // E, 1-letter
  assert.equal(p.cells[2][0].acrossWord.num, 6);
  assert.equal(p.cells[2][1].acrossWord.num, 6);
  assert.equal(p.cells[2][2].acrossWord.num, 6);
});

test('computeNumbering links down-word membership; every white cell has a downWord', () => {
  const p = parseIpuz(tinyIpuz);
  assert.equal(p.cells[0][0].downWord.num, 1);
  assert.equal(p.cells[1][0].downWord.num, 1);
  assert.equal(p.cells[2][0].downWord.num, 1);
  assert.equal(p.cells[0][1].downWord.num, 2); // B, 1-letter
  assert.equal(p.cells[0][2].downWord.num, 3);
  assert.equal(p.cells[1][2].downWord.num, 3);
  assert.equal(p.cells[2][2].downWord.num, 3);
  assert.equal(p.cells[2][1].downWord.num, 7); // G, 1-letter
});

test('computeNumbering populates acrossStarts and downStarts with positions and lengths', () => {
  const p = parseIpuz(tinyIpuz);
  assert.deepEqual(
    p.numbering.acrossStarts.map(w => ({ num: w.num, r: w.r, c: w.c, len: w.len })),
    [
      { num: 1, r: 0, c: 0, len: 3 },
      { num: 4, r: 1, c: 0, len: 1 },
      { num: 5, r: 1, c: 2, len: 1 },
      { num: 6, r: 2, c: 0, len: 3 },
    ]
  );
  assert.deepEqual(
    p.numbering.downStarts.map(w => ({ num: w.num, r: w.r, c: w.c, len: w.len })),
    [
      { num: 1, r: 0, c: 0, len: 3 },
      { num: 2, r: 0, c: 1, len: 1 },
      { num: 3, r: 0, c: 2, len: 3 },
      { num: 7, r: 2, c: 1, len: 1 },
    ]
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: numbering tests fail (numbers are still null from the stub).

- [ ] **Step 3: Replace the stub `computeNumbering`**

In `engine.js`, replace the stub `computeNumbering` with:
```js
export function computeNumbering(puzzle) {
  const { rows, cols, cells } = puzzle;
  const isWhite = (r, c) =>
    r >= 0 && r < rows && c >= 0 && c < cols && !cells[r][c].isBlock;

  const acrossStarts = [];
  const downStarts = [];
  let n = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = cells[r][c];
      if (cell.isBlock) continue;
      const startsAcross = !isWhite(r, c - 1);
      const startsDown   = !isWhite(r - 1, c);
      if (!startsAcross && !startsDown) continue;
      n += 1;
      cell.number = n;
      if (startsAcross) {
        let len = 0;
        let cc = c;
        while (isWhite(r, cc)) { cc++; len++; }
        const entry = { num: n, r, c, len, dir: 'across' };
        acrossStarts.push(entry);
        for (let i = 0; i < len; i++) cells[r][c + i].acrossWord = entry;
      }
      if (startsDown) {
        let len = 0;
        let rr = r;
        while (isWhite(rr, c)) { rr++; len++; }
        const entry = { num: n, r, c, len, dir: 'down' };
        downStarts.push(entry);
        for (let i = 0; i < len; i++) cells[r + i][c].downWord = entry;
      }
    }
  }

  puzzle.numbering.acrossStarts = acrossStarts;
  puzzle.numbering.downStarts = downStarts;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all numbering tests pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): computeNumbering assigns numbers and word membership"
```

---

## Task 4: `createInitialState` — fresh solver state for a puzzle

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

The state shape is exactly what the spec defines. The cursor starts on the first white cell encountered in row-major order; the direction defaults to `"across"` (or `"down"` if the first white cell has no across word).

- [ ] **Step 1: Write the failing test**

Append to `tests/engine.test.js`:
```js
import { createInitialState } from '../engine.js';

test('createInitialState seeds empty entries, locked, and a sensible cursor', () => {
  const p = parseIpuz(tinyIpuz);
  const s = createInitialState(p);
  assert.deepEqual(s.entries, {});
  assert.deepEqual(s.locked, {});
  assert.deepEqual(s.cursor, { r: 0, c: 0 });
  assert.equal(s.direction, 'across');
  assert.equal(s.autoCheck, false);
  assert.equal(s.solvedAt, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: `createInitialState is not exported`.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
export function createInitialState(puzzle) {
  let cursor = { r: 0, c: 0 };
  let direction = 'across';
  outer:
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (!puzzle.cells[r][c].isBlock) {
        cursor = { r, c };
        if (!puzzle.cells[r][c].acrossWord && puzzle.cells[r][c].downWord) {
          direction = 'down';
        }
        break outer;
      }
    }
  }
  return {
    entries: {},
    locked: {},
    cursor,
    direction,
    autoCheck: false,
    solvedAt: null,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): createInitialState seeds blank solver state"
```

---

## Task 5: `typeLetter` — write a letter at the cursor and advance

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

**Behavior:**
- Uppercases the input.
- Refuses to write to a locked cell (returns state unchanged).
- Refuses to write to a block (returns state unchanged — shouldn't happen, but defensive).
- After writing, advances the cursor to the next white cell in the current direction within the current word. At the last cell of the word, the cursor stays put (no auto-jump to next word).
- Returns a new state object (immutable update).

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
import { typeLetter } from '../engine.js';

test('typeLetter writes uppercase at cursor and advances within word', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = typeLetter(s, p, 'm');
  assert.equal(s.entries['0,0'], 'M');
  assert.deepEqual(s.cursor, { r: 0, c: 1 });
});

test('typeLetter stays at last cell of word', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = { ...s, cursor: { r: 0, c: 2 }, direction: 'across' };
  s = typeLetter(s, p, 'X');
  assert.equal(s.entries['0,2'], 'X');
  assert.deepEqual(s.cursor, { r: 0, c: 2 });
});

test('typeLetter respects direction down', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = { ...s, direction: 'down' };
  s = typeLetter(s, p, 'a');
  assert.equal(s.entries['0,0'], 'A');
  assert.deepEqual(s.cursor, { r: 1, c: 0 });
});

test('typeLetter is a no-op on a locked cell', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = { ...s, locked: { '0,0': true }, entries: { '0,0': 'A' } };
  const after = typeLetter(s, p, 'Z');
  assert.equal(after.entries['0,0'], 'A');
  assert.deepEqual(after.cursor, s.cursor);
});

test('typeLetter does not mutate input state', () => {
  const p = parseIpuz(tinyIpuz);
  const s = createInitialState(p);
  const snapshot = JSON.stringify(s);
  typeLetter(s, p, 'M');
  assert.equal(JSON.stringify(s), snapshot);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: typeLetter not exported.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
const key = (r, c) => `${r},${c}`;

function nextCellInDirection(puzzle, r, c, direction) {
  // Move one step in `direction`; return null if we'd leave the current word.
  const word = direction === 'across'
    ? puzzle.cells[r][c].acrossWord
    : puzzle.cells[r][c].downWord;
  if (!word) return null;
  if (direction === 'across') {
    const last = word.c + word.len - 1;
    if (c < last) return { r, c: c + 1 };
    return null;
  } else {
    const last = word.r + word.len - 1;
    if (r < last) return { r: r + 1, c };
    return null;
  }
}

export function typeLetter(state, puzzle, letter) {
  const { r, c } = state.cursor;
  const cell = puzzle.cells[r][c];
  if (cell.isBlock) return state;
  if (state.locked[key(r, c)]) return state;
  const upper = String(letter).toUpperCase();
  if (!/^[A-Z]$/.test(upper)) return state;
  const newEntries = { ...state.entries, [key(r, c)]: upper };
  const next = nextCellInDirection(puzzle, r, c, state.direction);
  return {
    ...state,
    entries: newEntries,
    cursor: next ?? state.cursor,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): typeLetter writes and advances cursor"
```

---

## Task 6: `backspace` — delete with smart cursor behavior

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

**Behavior:**
- If the active cell is empty: move back one cell in the current direction (if possible) and clear that previous cell's entry.
- If the active cell is non-empty: clear the active cell's entry, leave cursor where it is.
- Locked cells: skip past them when moving back (don't clear them); if the only candidate to move to is locked, just clear the active cell.
- Returns a new state object.

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
import { backspace } from '../engine.js';

test('backspace on a non-empty cell clears it without moving', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = { ...s, entries: { '0,0': 'A' }, cursor: { r: 0, c: 0 } };
  s = backspace(s, p);
  assert.equal(s.entries['0,0'], undefined);
  assert.deepEqual(s.cursor, { r: 0, c: 0 });
});

test('backspace on an empty cell moves back and clears the previous cell', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = { ...s, entries: { '0,0': 'A' }, cursor: { r: 0, c: 1 } };
  s = backspace(s, p);
  assert.equal(s.entries['0,0'], undefined);
  assert.deepEqual(s.cursor, { r: 0, c: 0 });
});

test('backspace at start of word with empty cursor is a no-op', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = { ...s, cursor: { r: 0, c: 0 } };
  const before = JSON.stringify(s);
  s = backspace(s, p);
  assert.equal(JSON.stringify(s), before);
});

test('backspace skips locked cells when moving back', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = {
    ...s,
    cursor: { r: 0, c: 2 },
    entries: { '0,0': 'A', '0,1': 'B' },
    locked: { '0,1': true },
  };
  s = backspace(s, p);
  assert.equal(s.entries['0,0'], undefined);
  assert.equal(s.entries['0,1'], 'B'); // locked, untouched
  assert.deepEqual(s.cursor, { r: 0, c: 0 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: backspace not exported.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
function prevCellInWord(puzzle, r, c, direction) {
  const word = direction === 'across'
    ? puzzle.cells[r][c].acrossWord
    : puzzle.cells[r][c].downWord;
  if (!word) return null;
  if (direction === 'across') {
    if (c > word.c) return { r, c: c - 1 };
    return null;
  } else {
    if (r > word.r) return { r: r - 1, c };
    return null;
  }
}

export function backspace(state, puzzle) {
  const { r, c } = state.cursor;
  const k = key(r, c);
  if (state.entries[k]) {
    const newEntries = { ...state.entries };
    delete newEntries[k];
    return { ...state, entries: newEntries };
  }
  // Active cell empty: walk backward across locked cells.
  let cur = { r, c };
  while (true) {
    const prev = prevCellInWord(puzzle, cur.r, cur.c, state.direction);
    if (!prev) return state;
    if (!state.locked[key(prev.r, prev.c)]) {
      const newEntries = { ...state.entries };
      delete newEntries[key(prev.r, prev.c)];
      return { ...state, entries: newEntries, cursor: prev };
    }
    cur = prev;
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): backspace with locked-cell awareness"
```

---

## Task 7: `moveCursor` and `toggleDirection` — arrow-key navigation

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

**Behavior:**
- `moveCursor(state, puzzle, dr, dc)`: move one cell in (dr, dc), skipping blocks. If `(dr, dc)` is perpendicular to current `direction`, also flip `direction`. Stay put if no white cell exists in that direction (off-grid or only blocks).
- `toggleDirection(state)`: flip across ↔ down. Cursor unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
import { moveCursor, toggleDirection } from '../engine.js';

test('moveCursor walks in the requested direction skipping blocks', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  // From (0,1) moving down should land on (2,1) (skipping the block at (1,1))
  s = { ...s, cursor: { r: 0, c: 1 }, direction: 'across' };
  s = moveCursor(s, p, 1, 0);
  assert.deepEqual(s.cursor, { r: 2, c: 1 });
  assert.equal(s.direction, 'down'); // perpendicular flip
});

test('moveCursor does not flip direction when moving along current direction', () => {
  const p = parseIpuz(tinyIpuz);
  let s = { ...createInitialState(p), direction: 'across' };
  s = moveCursor(s, p, 0, 1);
  assert.deepEqual(s.cursor, { r: 0, c: 1 });
  assert.equal(s.direction, 'across');
});

test('moveCursor stays put when no white cell exists that direction', () => {
  const p = parseIpuz(tinyIpuz);
  let s = { ...createInitialState(p), cursor: { r: 0, c: 0 }, direction: 'across' };
  s = moveCursor(s, p, -1, 0);
  assert.deepEqual(s.cursor, { r: 0, c: 0 });
});

test('toggleDirection flips across<->down without moving', () => {
  const p = parseIpuz(tinyIpuz);
  const s = createInitialState(p);
  const flipped = toggleDirection(s);
  assert.equal(flipped.direction, 'down');
  assert.deepEqual(flipped.cursor, s.cursor);
  assert.equal(toggleDirection(flipped).direction, 'across');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: moveCursor / toggleDirection not exported.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
export function moveCursor(state, puzzle, dr, dc) {
  let { r, c } = state.cursor;
  while (true) {
    r += dr; c += dc;
    if (r < 0 || r >= puzzle.rows || c < 0 || c >= puzzle.cols) return state;
    if (!puzzle.cells[r][c].isBlock) break;
  }
  const isPerpendicular =
    (state.direction === 'across' && dr !== 0) ||
    (state.direction === 'down' && dc !== 0);
  return {
    ...state,
    cursor: { r, c },
    direction: isPerpendicular
      ? (state.direction === 'across' ? 'down' : 'across')
      : state.direction,
  };
}

export function toggleDirection(state) {
  return { ...state, direction: state.direction === 'across' ? 'down' : 'across' };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): moveCursor and toggleDirection"
```

---

## Task 8: `tabToWord` — jump to next/previous word

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

**Behavior:**
- `tabToWord(state, puzzle, reverse=false)`: jump cursor to the first cell of the next (or previous) word.
- "Next" order: all across words by number ascending, then all down words by number ascending. Wrap from end → start (and start ← end on reverse).
- After tabbing, set `direction` to match the destination word's direction.
- If the cursor is currently at a cell that has both an across and down word, "next" depends on the current direction: if currently `across`, next is the next across word (or the first down word after the last across); if currently `down`, next is the next down word (wrap to first across after last down).

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
import { tabToWord } from '../engine.js';

// Note: with this puzzle's non-standard numbering, the tinyIpuz fixture has
// 8 entries: 1A (ABC), 4A (D), 5A (E), 6A (FGH), 1D (ADF), 2D (B), 3D (CEH), 7D (G).
test('tabToWord cycles forward across-then-down with wrap', () => {
  const p = parseIpuz(tinyIpuz);
  let s = { ...createInitialState(p), cursor: { r: 0, c: 0 }, direction: 'across' };
  // 1A → 4A
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 1, c: 0 }, direction: 'across' });
  // 4A → 5A
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 1, c: 2 }, direction: 'across' });
  // 5A → 6A
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 2, c: 0 }, direction: 'across' });
  // 6A → 1D
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 0, c: 0 }, direction: 'down' });
  // 1D → 2D → 3D → 7D → wraps to 1A
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 0, c: 1 }, direction: 'down' });
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 0, c: 2 }, direction: 'down' });
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 2, c: 1 }, direction: 'down' });
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 0, c: 0 }, direction: 'across' });
});

test('tabToWord reverse from 1A wraps to 7D', () => {
  const p = parseIpuz(tinyIpuz);
  let s = { ...createInitialState(p), cursor: { r: 0, c: 0 }, direction: 'across' };
  s = tabToWord(s, p, true);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 2, c: 1 }, direction: 'down' });
});

test('tabToWord starting from a non-start cell jumps to the next word, not the current one', () => {
  const p = parseIpuz(tinyIpuz);
  // Cursor in the middle of 1A should tab to 4A on next.
  let s = { ...createInitialState(p), cursor: { r: 0, c: 1 }, direction: 'across' };
  s = tabToWord(s, p, false);
  assert.deepEqual({ cursor: s.cursor, direction: s.direction }, { cursor: { r: 1, c: 0 }, direction: 'across' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: tabToWord not exported.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
export function tabToWord(state, puzzle, reverse = false) {
  const ordered = [
    ...puzzle.numbering.acrossStarts,
    ...puzzle.numbering.downStarts,
  ];
  // Find the current word (or current word's start if cursor is mid-word).
  const cur = puzzle.cells[state.cursor.r][state.cursor.c];
  const currentWord = state.direction === 'across' ? cur.acrossWord : cur.downWord;
  let idx;
  if (currentWord) {
    idx = ordered.findIndex(w => w === currentWord);
  } else {
    idx = -1;
  }
  const step = reverse ? -1 : 1;
  const len = ordered.length;
  const targetIdx = (idx + step + len) % len;
  const target = ordered[targetIdx];
  return {
    ...state,
    cursor: { r: target.r, c: target.c },
    direction: target.dir,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): tabToWord cycles across then down with wrap"
```

---

## Task 9: `clickCell` — pointer-driven cursor placement and direction toggle

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

**Behavior:**
- Clicking a non-block cell at `(r, c)`:
  - If `(r, c)` is the *current* cursor: toggle direction.
  - Otherwise: move cursor to `(r, c)` and keep the current direction. (With this puzzle's numbering rule every white cell has both an across and a down entry, so no direction fallback is needed.)
- Clicking a block cell: no-op.

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
import { clickCell } from '../engine.js';

test('clickCell on a different cell moves cursor and keeps direction', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = clickCell(s, p, 2, 1);
  assert.deepEqual(s.cursor, { r: 2, c: 1 });
  assert.equal(s.direction, 'across');
});

test('clickCell on the current cell toggles direction', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = clickCell(s, p, 0, 0);
  assert.deepEqual(s.cursor, { r: 0, c: 0 });
  assert.equal(s.direction, 'down');
});

test('clickCell on a block cell is a no-op', () => {
  const p = parseIpuz(tinyIpuz);
  const s = createInitialState(p);
  const after = clickCell(s, p, 1, 1);
  assert.deepEqual(after, s);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: clickCell not exported.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
export function clickCell(state, puzzle, r, c) {
  const cell = puzzle.cells[r][c];
  if (cell.isBlock) return state;
  if (state.cursor.r === r && state.cursor.c === c) {
    return toggleDirection(state);
  }
  return { ...state, cursor: { r, c } };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): clickCell with direction-fallback"
```

---

## Task 10: Check functions — `isCorrect`, `wrongCells`, `isSolved`, `setAutoCheck`

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
import { isCorrect, wrongCells, isSolved, setAutoCheck } from '../engine.js';

test('isCorrect true when entry matches solution', () => {
  const p = parseIpuz(tinyIpuz);
  const s = { ...createInitialState(p), entries: { '0,0': 'A', '0,1': 'X' } };
  assert.equal(isCorrect(s, p, 0, 0), true);
  assert.equal(isCorrect(s, p, 0, 1), false);
  assert.equal(isCorrect(s, p, 0, 2), false); // empty
});

test('wrongCells returns positions of filled-but-wrong cells only', () => {
  const p = parseIpuz(tinyIpuz);
  const s = { ...createInitialState(p), entries: { '0,0': 'A', '0,1': 'X', '2,2': 'Z' } };
  const w = wrongCells(s, p);
  assert.deepEqual(
    w.map(([r, c]) => `${r},${c}`).sort(),
    ['0,1', '2,2']
  );
});

test('isSolved true only when every white cell is correct', () => {
  const p = parseIpuz(tinyIpuz);
  const full = {
    '0,0': 'A', '0,1': 'B', '0,2': 'C',
    '1,0': 'D',              '1,2': 'E',
    '2,0': 'F', '2,1': 'G', '2,2': 'H',
  };
  const s = { ...createInitialState(p), entries: full };
  assert.equal(isSolved(s, p), true);
  const wrong = { ...full, '0,0': 'Z' };
  assert.equal(isSolved({ ...s, entries: wrong }, p), false);
});

test('setAutoCheck toggles flag immutably', () => {
  const p = parseIpuz(tinyIpuz);
  const s = createInitialState(p);
  const on = setAutoCheck(s, true);
  assert.equal(on.autoCheck, true);
  assert.equal(s.autoCheck, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: not-exported errors.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
export function isCorrect(state, puzzle, r, c) {
  const k = key(r, c);
  return state.entries[k] === puzzle.cells[r][c].solution;
}

export function wrongCells(state, puzzle) {
  const out = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (puzzle.cells[r][c].isBlock) continue;
      const v = state.entries[key(r, c)];
      if (v && v !== puzzle.cells[r][c].solution) out.push([r, c]);
    }
  }
  return out;
}

export function isSolved(state, puzzle) {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = puzzle.cells[r][c];
      if (cell.isBlock) continue;
      if (state.entries[key(r, c)] !== cell.solution) return false;
    }
  }
  return true;
}

export function setAutoCheck(state, on) {
  return { ...state, autoCheck: !!on };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): correctness checks and autoCheck toggle"
```

---

## Task 11: Reveal actions and `clearAll`

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
import { revealLetter, revealWord, revealPuzzle, clearAll } from '../engine.js';

test('revealLetter writes solution and locks the active cell', () => {
  const p = parseIpuz(tinyIpuz);
  let s = { ...createInitialState(p), cursor: { r: 0, c: 1 } };
  s = revealLetter(s, p);
  assert.equal(s.entries['0,1'], 'B');
  assert.equal(s.locked['0,1'], true);
});

test('revealWord fills all cells of the active word and locks them', () => {
  const p = parseIpuz(tinyIpuz);
  let s = { ...createInitialState(p), cursor: { r: 0, c: 1 }, direction: 'across' };
  s = revealWord(s, p);
  assert.equal(s.entries['0,0'], 'A');
  assert.equal(s.entries['0,1'], 'B');
  assert.equal(s.entries['0,2'], 'C');
  assert.equal(s.locked['0,0'], true);
  assert.equal(s.locked['0,1'], true);
  assert.equal(s.locked['0,2'], true);
});

test('revealWord on a cell with no word in current direction is a no-op', () => {
  const p = parseIpuz(tinyIpuz);
  let s = { ...createInitialState(p), cursor: { r: 1, c: 0 }, direction: 'across' };
  // (1,0) has no across word.
  const after = revealWord(s, p);
  assert.deepEqual(after, s);
});

test('revealPuzzle fills every white cell and locks them; does not set solvedAt', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = revealPuzzle(s, p);
  assert.equal(s.entries['1,2'], 'E');
  assert.equal(s.locked['1,2'], true);
  assert.equal(s.solvedAt, null);
});

test('clearAll wipes entries, locked, and solvedAt; preserves cursor/direction/autoCheck', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = { ...s, entries: { '0,0': 'A' }, locked: { '0,0': true }, solvedAt: '2026-01-01T00:00:00Z', autoCheck: true, cursor: { r: 2, c: 2 }, direction: 'down' };
  const cleared = clearAll(s);
  assert.deepEqual(cleared.entries, {});
  assert.deepEqual(cleared.locked, {});
  assert.equal(cleared.solvedAt, null);
  assert.equal(cleared.autoCheck, true);
  assert.deepEqual(cleared.cursor, { r: 2, c: 2 });
  assert.equal(cleared.direction, 'down');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: not-exported errors.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
export function revealLetter(state, puzzle) {
  const { r, c } = state.cursor;
  const cell = puzzle.cells[r][c];
  if (cell.isBlock) return state;
  return {
    ...state,
    entries: { ...state.entries, [key(r, c)]: cell.solution },
    locked: { ...state.locked, [key(r, c)]: true },
  };
}

export function revealWord(state, puzzle) {
  const { r, c } = state.cursor;
  const cell = puzzle.cells[r][c];
  const word = state.direction === 'across' ? cell.acrossWord : cell.downWord;
  if (!word) return state;
  const entries = { ...state.entries };
  const locked = { ...state.locked };
  for (let i = 0; i < word.len; i++) {
    const wr = word.r + (state.direction === 'down' ? i : 0);
    const wc = word.c + (state.direction === 'across' ? i : 0);
    entries[key(wr, wc)] = puzzle.cells[wr][wc].solution;
    locked[key(wr, wc)] = true;
  }
  return { ...state, entries, locked };
}

export function revealPuzzle(state, puzzle) {
  const entries = { ...state.entries };
  const locked = { ...state.locked };
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const cell = puzzle.cells[r][c];
      if (cell.isBlock) continue;
      entries[key(r, c)] = cell.solution;
      locked[key(r, c)] = true;
    }
  }
  return { ...state, entries, locked };
}

export function clearAll(state) {
  return { ...state, entries: {}, locked: {}, solvedAt: null };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): reveal letter/word/puzzle and clearAll"
```

---

## Task 12: `saveState` / `loadState` — localStorage persistence

**Files:**
- Modify: `engine.js`
- Modify: `tests/engine.test.js`

**Behavior:**
- `saveState(state, puzzle, storage = globalThis.localStorage)`: writes `JSON.stringify(state)` to `storage` under key `xword:${puzzle.id}`. Catches and logs any error (e.g. quota exceeded) without throwing.
- `loadState(puzzle, storage = globalThis.localStorage)`: reads the same key, parses, returns `null` if missing or unparseable. Also returns `null` if the loaded state's grid dimensions don't match the puzzle (handled by storing `_dim: "rows,cols"` alongside `_state` in the persisted JSON).

Persisted shape:
```json
{ "dim": "15,15", "state": { "entries": {}, ... } }
```

- [ ] **Step 1: Write the failing tests**

Append to `tests/engine.test.js`:
```js
import { saveState, loadState } from '../engine.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test('saveState then loadState round-trips state', () => {
  const p = parseIpuz(tinyIpuz);
  const s = { ...createInitialState(p), entries: { '0,0': 'A' }, autoCheck: true };
  const storage = fakeStorage();
  saveState(s, p, storage);
  const loaded = loadState(p, storage);
  assert.deepEqual(loaded.entries, { '0,0': 'A' });
  assert.equal(loaded.autoCheck, true);
});

test('loadState returns null when nothing is stored', () => {
  const p = parseIpuz(tinyIpuz);
  const storage = fakeStorage();
  assert.equal(loadState(p, storage), null);
});

test('loadState returns null when stored dimensions disagree with current puzzle', () => {
  const p = parseIpuz(tinyIpuz);
  const storage = fakeStorage();
  storage.setItem(`xword:${p.id}`, JSON.stringify({ dim: '99,99', state: { entries: {} } }));
  assert.equal(loadState(p, storage), null);
});

test('saveState is non-throwing if storage rejects writes', () => {
  const p = parseIpuz(tinyIpuz);
  const s = createInitialState(p);
  const broken = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {},
  };
  saveState(s, p, broken); // must not throw
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: not-exported errors.

- [ ] **Step 3: Implement**

Append to `engine.js`:
```js
const storageKey = (puzzle) => `xword:${puzzle.id}`;

export function saveState(state, puzzle, storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    const payload = JSON.stringify({
      dim: `${puzzle.rows},${puzzle.cols}`,
      state,
    });
    storage.setItem(storageKey(puzzle), payload);
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('saveState failed:', e);
  }
}

export function loadState(puzzle, storage = globalThis.localStorage) {
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(storageKey(puzzle));
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (parsed?.dim !== `${puzzle.rows},${puzzle.cols}`) return null;
  return parsed.state ?? null;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat(engine): saveState/loadState with dimension guard"
```

---

## Task 13: HTML shell and base CSS

**Files:**
- Create: `crossword.html`
- Create: `app.js` (empty placeholder)

This task lays out the markup and styles. No behavior yet. Just the skeleton.

- [ ] **Step 1: Create empty `app.js`**

Write `app.js`:
```js
// App layer — DOM rendering and event handling. Wired up in later tasks.
import * as engine from './engine.js';
console.log('app.js loaded; engine has', Object.keys(engine).length, 'exports');
```

- [ ] **Step 2: Create `crossword.html`**

Write `crossword.html`:
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Crossword</title>
<style>
  :root {
    --fg: #111;
    --bg: #fff;
    --block: #111;
    --grid-line: #111;
    --active: #fff5a8;
    --active-word: #d8e7ff;
    --wrong: #d23;
    --locked: #2563b3;
    --muted: #666;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    overscroll-behavior: none;
  }
  body {
    display: flex; flex-direction: column; align-items: center;
    padding: 12px; gap: 12px;
    min-height: 100vh;
  }
  h1 {
    font-size: 1.1rem; margin: 0; font-weight: 600; text-align: center;
  }
  #toolbar {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center;
  }
  #toolbar button, #toolbar label {
    font: inherit; padding: 6px 10px; border: 1px solid #ccc; border-radius: 6px;
    background: #f6f6f6; cursor: pointer;
  }
  #toolbar button:active { background: #e6e6e6; }
  #toolbar label { display: inline-flex; align-items: center; gap: 6px; }
  #grid {
    display: grid;
    width: min(96vw, calc(100vh - 180px));
    aspect-ratio: 1 / 1;
    background: var(--grid-line);
    gap: 1px; border: 1px solid var(--grid-line);
    user-select: none;
    touch-action: manipulation;
  }
  .cell {
    background: var(--bg); position: relative;
    display: flex; align-items: center; justify-content: center;
    font-size: clamp(14px, 4vw, 28px); font-weight: 600;
    cursor: pointer;
  }
  .cell.block { background: var(--block); cursor: default; }
  .cell .num {
    position: absolute; top: 1px; left: 2px;
    font-size: 0.5em; font-weight: 500; color: var(--muted);
    line-height: 1;
  }
  .cell.active { background: var(--active); }
  .cell.active-word { background: var(--active-word); }
  .cell.active.active-word { background: var(--active); }
  .cell.wrong .letter { color: var(--wrong); }
  .cell.wrong::after {
    content: ""; position: absolute; top: 0; right: 0;
    width: 0; height: 0;
    border-top: 8px solid var(--wrong);
    border-left: 8px solid transparent;
  }
  .cell.locked .letter { color: var(--locked); }
  #hidden-input {
    position: fixed; left: -9999px; top: 0;
    opacity: 0; pointer-events: none;
    font-size: 16px; /* prevents iOS auto-zoom */
  }
  #overlay {
    position: fixed; inset: 0; background: rgba(255, 255, 255, 0.92);
    display: none; align-items: center; justify-content: center; flex-direction: column; gap: 12px;
    z-index: 10;
  }
  #overlay.show { display: flex; }
  #overlay h2 { font-size: 2rem; margin: 0; }
  #overlay button {
    padding: 8px 16px; font: inherit; border: 1px solid #ccc; border-radius: 6px; background: #f6f6f6;
  }
</style>
</head>
<body>
  <h1 id="title">Crossword</h1>

  <div id="toolbar" role="toolbar" aria-label="Crossword controls">
    <label><input type="checkbox" id="auto-check"> Auto-check</label>
    <button id="check">Check</button>
    <button id="reveal-letter">Reveal letter</button>
    <button id="reveal-word">Reveal word</button>
    <button id="reveal-puzzle">Reveal puzzle</button>
    <button id="clear">Clear</button>
  </div>

  <div id="grid" role="grid" aria-label="Crossword grid"></div>

  <input id="hidden-input"
         type="text"
         autocomplete="off"
         autocorrect="off"
         autocapitalize="characters"
         spellcheck="false"
         inputmode="text"
         aria-hidden="true"
         tabindex="-1">

  <div id="overlay" role="dialog" aria-modal="true" aria-label="Solved">
    <h2 id="overlay-title">Solved!</h2>
    <button id="overlay-close">Close</button>
  </div>

  <script type="module" src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Smoke-check the HTML opens (manual, don't worry about behavior yet)**

Start a tiny static server from the project directory and open `http://localhost:8000/crossword.html` in any browser:
```bash
python3 -m http.server 8000
```
Expected: Page loads with the title "Crossword", a toolbar of buttons, an empty grid box, and (in the browser console) a log line from `app.js`. No JavaScript errors.

(Stop the server with Ctrl-C. Don't leave it running.)

- [ ] **Step 4: Commit**

```bash
git add crossword.html app.js
git commit -m "feat(ui): HTML shell, CSS, and module bootstrap"
```

---

## Task 14: `app.js` — render grid from a parsed puzzle

**Files:**
- Modify: `app.js`

**Behavior:**
- Define `renderGrid(puzzle)` that builds the `#grid` element's children: one `<div class="cell">` per cell. Block cells get `.block`. White cells get a small `<span class="num">` (when numbered) and an empty `<span class="letter"></span>`.
- Set `#grid` `grid-template-columns` and `grid-template-rows` to match the puzzle dimensions.
- Define `renderState(puzzle, state)` that updates per-cell classes (`active`, `active-word`, `locked`, `wrong`) and the `<span class="letter">` text.
- The `renderState` function must be idempotent: callable many times with the same state, no stale classes left behind.
- Bootstrap (at the bottom of `app.js` for now): hard-code a tiny inline puzzle for development, render it.

This task introduces a "wrong-marks" state separate from the engine. The engine doesn't track marks; the app does:
- When `state.autoCheck` is true, marks = current `wrongCells(state, puzzle)`.
- When auto-check is off, marks come from a `marks` Set the app maintains, populated by Check button (Task 16) and cleared per cell on edit.

For this task we only need the rendering plumbing. The marks Set will start empty.

- [ ] **Step 1: Replace `app.js`**

Replace `app.js`:
```js
import {
  parseIpuz, createInitialState, wrongCells, isCorrect,
} from './engine.js';

const $ = (sel) => document.querySelector(sel);
const $grid = $('#grid');
const $title = $('#title');

let puzzle = null;
let state = null;
let marks = new Set();   // "r,c" cells flagged wrong (used when autoCheck is off)

export function renderGrid(p) {
  $grid.style.gridTemplateColumns = `repeat(${p.cols}, 1fr)`;
  $grid.style.gridTemplateRows = `repeat(${p.rows}, 1fr)`;
  $grid.replaceChildren();
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      const cell = p.cells[r][c];
      const el = document.createElement('div');
      el.className = 'cell' + (cell.isBlock ? ' block' : '');
      el.dataset.r = r;
      el.dataset.c = c;
      if (!cell.isBlock) {
        if (cell.number) {
          const num = document.createElement('span');
          num.className = 'num';
          num.textContent = cell.number;
          el.appendChild(num);
        }
        const letter = document.createElement('span');
        letter.className = 'letter';
        el.appendChild(letter);
      }
      $grid.appendChild(el);
    }
  }
}

function activeWordCells(p, s) {
  const cell = p.cells[s.cursor.r][s.cursor.c];
  if (cell.isBlock) return new Set();
  const word = s.direction === 'across' ? cell.acrossWord : cell.downWord;
  if (!word) return new Set();
  const cells = new Set();
  for (let i = 0; i < word.len; i++) {
    const r = word.r + (s.direction === 'down' ? i : 0);
    const cc = word.c + (s.direction === 'across' ? i : 0);
    cells.add(`${r},${cc}`);
  }
  return cells;
}

export function renderState(p, s, wrongMarks) {
  const activeKey = `${s.cursor.r},${s.cursor.c}`;
  const wordKeys = activeWordCells(p, s);
  const liveWrong = s.autoCheck
    ? new Set(wrongCells(s, p).map(([r, c]) => `${r},${c}`))
    : wrongMarks;
  for (const el of $grid.children) {
    const r = +el.dataset.r;
    const c = +el.dataset.c;
    const k = `${r},${c}`;
    const cell = p.cells[r][c];
    if (cell.isBlock) continue;
    el.classList.toggle('active', k === activeKey);
    el.classList.toggle('active-word', wordKeys.has(k) && k !== activeKey);
    el.classList.toggle('locked', !!s.locked[k]);
    el.classList.toggle('wrong', liveWrong.has(k));
    const letterEl = el.querySelector('.letter');
    letterEl.textContent = s.entries[k] ?? '';
  }
}

// Dev bootstrap: hard-coded tiny puzzle for now. Replaced in Task 20 with real fetch.
const DEV_PUZZLE = {
  kind: ['http://ipuz.org/crossword#1'],
  dimensions: { width: 3, height: 3 },
  puzzle: [[1, 0, 2], [0, '#', 0], [3, 0, 0]],
  solution: [['A', 'B', 'C'], ['D', '#', 'E'], ['F', 'G', 'H']],
  block: '#',
  title: 'Dev Tiny',
  id: 'dev-tiny',
};
puzzle = parseIpuz(DEV_PUZZLE);
state = createInitialState(puzzle);
$title.textContent = puzzle.title;
renderGrid(puzzle);
renderState(puzzle, state, marks);
```

- [ ] **Step 2: Smoke-check**

Run a static server (`python3 -m http.server 8000`) and open the page. Expected: a 3×3 grid renders with letters absent, block in the center, numbers "1", "2", "3" in their corners, and the active cell at top-left highlighted yellow with the rest of "1A" pale blue. No console errors.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(ui): render grid and state with active/active-word/wrong/locked classes"
```

---

## Task 15: Keyboard handling — wire the hidden input to engine state

**Files:**
- Modify: `app.js`

**Behavior:**
- Focus `#hidden-input` on load and after any cell tap.
- Listen for `keydown`. Map keys:
  - `A`–`Z` (case-insensitive): `typeLetter`. Clear that cell's `marks` entry.
  - `Backspace`: `backspace`. Clear that cell's `marks` entry.
  - `Space`: `toggleDirection`.
  - `ArrowLeft/Right/Up/Down`: `moveCursor` with the corresponding (dr, dc).
  - `Tab` / `Shift+Tab`: `tabToWord(state, p, shiftKey)`. Prevent default browser tab.
  - `Enter`: prevent default; no-op.
- After every state change, call `renderState`. Save state (debounced — see Task 19; for now, save synchronously after each event for simplicity, we'll wrap in a debounce later).

- [ ] **Step 1: Add input + key handling to `app.js`**

Append to `app.js`, just before the dev bootstrap block:

```js
import {
  typeLetter, backspace, toggleDirection, moveCursor, tabToWord,
} from './engine.js';

const $hidden = $('#hidden-input');

function focusHidden() {
  // On iOS this raises the keyboard. Calling preventScroll keeps the page from jumping.
  $hidden.focus({ preventScroll: true });
}

function setState(next) {
  state = next;
  renderState(puzzle, state, marks);
}

function clearMark(r, c) {
  marks.delete(`${r},${c}`);
}

function onKeyDown(ev) {
  if (!puzzle || !state) return;
  const k = ev.key;
  if (k === ' ' || k === 'Spacebar') {
    ev.preventDefault();
    setState(toggleDirection(state));
    return;
  }
  if (k === 'Backspace') {
    ev.preventDefault();
    const before = state.cursor;
    const next = backspace(state, puzzle);
    clearMark(next.cursor.r, next.cursor.c);
    clearMark(before.r, before.c);
    setState(next);
    return;
  }
  if (k === 'ArrowLeft')  { ev.preventDefault(); setState(moveCursor(state, puzzle, 0, -1)); return; }
  if (k === 'ArrowRight') { ev.preventDefault(); setState(moveCursor(state, puzzle, 0,  1)); return; }
  if (k === 'ArrowUp')    { ev.preventDefault(); setState(moveCursor(state, puzzle, -1, 0)); return; }
  if (k === 'ArrowDown')  { ev.preventDefault(); setState(moveCursor(state, puzzle,  1, 0)); return; }
  if (k === 'Tab') {
    ev.preventDefault();
    setState(tabToWord(state, puzzle, ev.shiftKey));
    return;
  }
  if (k === 'Enter') { ev.preventDefault(); return; }
  if (/^[a-zA-Z]$/.test(k)) {
    ev.preventDefault();
    const { r, c } = state.cursor;
    clearMark(r, c);
    setState(typeLetter(state, puzzle, k));
    return;
  }
}

$hidden.addEventListener('keydown', onKeyDown);

// Some mobile keyboards fire `input` instead of `keydown` for letters.
$hidden.addEventListener('input', (ev) => {
  const data = ev.data;
  if (data && /^[a-zA-Z]$/.test(data)) {
    const { r, c } = state.cursor;
    clearMark(r, c);
    setState(typeLetter(state, puzzle, data));
  }
  // Always wipe the input so it never accumulates value.
  $hidden.value = '';
});

window.addEventListener('load', focusHidden);
```

- [ ] **Step 2: Smoke-check**

Open the page. Type letters: they appear in the active cell and the cursor advances. Press space: direction toggles. Press arrow keys: cursor moves. Press Tab: cursor jumps to the next word.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(ui): keyboard handling via hidden input"
```

---

## Task 16: Pointer events — click/tap a cell to focus it

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Append to `app.js`**

Append (after the input wiring):
```js
import { clickCell } from './engine.js';

$grid.addEventListener('click', (ev) => {
  const target = ev.target.closest('.cell');
  if (!target || !target.dataset.r) return;
  const r = +target.dataset.r; const c = +target.dataset.c;
  if (puzzle.cells[r][c].isBlock) return;
  setState(clickCell(state, puzzle, r, c));
  focusHidden();
});
```

- [ ] **Step 2: Smoke-check**

Open the page. Click a cell: it becomes the active cell, the active word highlight follows, and the keyboard remains active (typing still works). Click the same cell again: direction toggles.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(ui): pointer click/tap routes to engine.clickCell"
```

---

## Task 17: Toolbar — auto-check, check, reveals, clear

**Files:**
- Modify: `app.js`

**Behavior:**
- `#auto-check` checkbox: bound to `state.autoCheck` (read on render, write on change).
- `#check` button: when auto-check is off, populate `marks` with the current wrong cells; force a re-render. When auto-check is on, this is a no-op.
- `#reveal-letter`, `#reveal-word`, `#reveal-puzzle`: dispatch the matching engine reveal; refocus hidden input.
- `#clear`: confirm dialog ("Clear all your progress?"); on confirm dispatch `clearAll` and empty `marks`.

- [ ] **Step 1: Append to `app.js`**

Append:
```js
import {
  setAutoCheck, revealLetter, revealWord, revealPuzzle, clearAll, wrongCells as engineWrong,
} from './engine.js';

const $autoCheck = $('#auto-check');
const $check = $('#check');
const $revealLetter = $('#reveal-letter');
const $revealWord = $('#reveal-word');
const $revealPuzzle = $('#reveal-puzzle');
const $clear = $('#clear');

$autoCheck.addEventListener('change', () => {
  setState(setAutoCheck(state, $autoCheck.checked));
});

$check.addEventListener('click', () => {
  if (state.autoCheck) return;
  marks = new Set(engineWrong(state, puzzle).map(([r, c]) => `${r},${c}`));
  renderState(puzzle, state, marks);
  focusHidden();
});

$revealLetter.addEventListener('click',  () => { setState(revealLetter(state, puzzle));  focusHidden(); });
$revealWord.addEventListener('click',    () => { setState(revealWord(state, puzzle));    focusHidden(); });
$revealPuzzle.addEventListener('click',  () => { setState(revealPuzzle(state, puzzle));  focusHidden(); });

$clear.addEventListener('click', () => {
  if (!confirm('Clear all your progress?')) return;
  marks = new Set();
  setState(clearAll(state));
  focusHidden();
});

// Reflect autoCheck changes initiated from setState into the checkbox UI.
const _origRender = renderState;
function renderAll() {
  $autoCheck.checked = state.autoCheck;
  _origRender(puzzle, state, marks);
}
// Wrap setState to use renderAll.
function setStateAll(next) { state = next; renderAll(); }
// Replace earlier setState references.
// (Comment for the executor: replace all earlier occurrences of `setState(` with `setStateAll(` after this point.
//  The simplest path: keep them — the original `setState` still works; the checkbox just isn't synced on
//  reveal/clear. To fix, route a single render through renderAll.)
```

Actually that's clumsy. Replace the wiring to use a single render path:

Modify `app.js` so that `setState` always renders via `renderAll`. Find the existing `setState` definition and replace with:

```js
function setState(next) {
  state = next;
  $autoCheck.checked = state.autoCheck;
  renderState(puzzle, state, marks);
}
```

(Remove the `_origRender` / `setStateAll` block. It was a sketch — the simpler version above is the actual implementation.)

- [ ] **Step 2: Smoke-check**

Open the page. Toggle auto-check: when on, wrong letters appear red as you type. When off, type a wrong letter and press Check: it goes red. Type over it: red goes away. Reveal letter / word / puzzle: corresponding cells fill in blue and become uneditable. Clear: confirm dialog, then grid empties.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(ui): toolbar wiring (auto-check, check, reveals, clear)"
```

---

## Task 18: Completion overlay

**Files:**
- Modify: `app.js`

**Behavior:**
- After every `typeLetter`-driven state change, run `isSolved(state, puzzle)`. On the first transition from false → true (track via the previous state's `solvedAt` being null and the current state's having no solvedAt yet), set `state.solvedAt` to `new Date().toISOString()` and show the overlay.
- Reveal actions do NOT trigger this — the keystroke handler is the only place we check.
- Overlay is dismissable by: clicking the Close button, clicking the overlay backdrop, pressing Esc.

- [ ] **Step 1: Modify `app.js`**

Find the keydown handler's letter branch:
```js
  if (/^[a-zA-Z]$/.test(k)) {
    ev.preventDefault();
    const { r, c } = state.cursor;
    clearMark(r, c);
    setState(typeLetter(state, puzzle, k));
    return;
  }
```
Replace with:
```js
  if (/^[a-zA-Z]$/.test(k)) {
    ev.preventDefault();
    const { r, c } = state.cursor;
    clearMark(r, c);
    const next = typeLetter(state, puzzle, k);
    setState(maybeMarkSolved(next));
    return;
  }
```

Same change inside the `input` listener:
```js
$hidden.addEventListener('input', (ev) => {
  const data = ev.data;
  if (data && /^[a-zA-Z]$/.test(data)) {
    const { r, c } = state.cursor;
    clearMark(r, c);
    const next = typeLetter(state, puzzle, data);
    setState(maybeMarkSolved(next));
  }
  $hidden.value = '';
});
```

Append the helper plus overlay wiring:
```js
import { isSolved } from './engine.js';

function maybeMarkSolved(next) {
  if (state.solvedAt || next.solvedAt) return next;
  if (!isSolved(next, puzzle)) return next;
  showOverlay();
  return { ...next, solvedAt: new Date().toISOString() };
}

const $overlay = $('#overlay');
const $overlayClose = $('#overlay-close');

function showOverlay() { $overlay.classList.add('show'); }
function hideOverlay() { $overlay.classList.remove('show'); focusHidden(); }

$overlayClose.addEventListener('click', hideOverlay);
$overlay.addEventListener('click', (ev) => {
  if (ev.target === $overlay) hideOverlay();
});
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && $overlay.classList.contains('show')) hideOverlay();
});
```

- [ ] **Step 2: Smoke-check**

Open the page. Use Reveal Puzzle (or type the answers manually). When you fill the last correct letter via typing, the overlay appears. Reveal Puzzle does NOT show the overlay. Esc / Close / clicking the backdrop dismisses it.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(ui): completion overlay on solver-driven solve"
```

---

## Task 19: Persistence — debounced save and load on init

**Files:**
- Modify: `app.js`

**Behavior:**
- Wrap `saveState` in a 150 ms debounce; call it from `setState`.
- On bootstrap, after parsing the puzzle, try `loadState(puzzle)`; use it if present, else `createInitialState`.

- [ ] **Step 1: Modify `app.js`**

Add the imports and the debouncer, then update `setState` and bootstrap:

Append imports near the top of `app.js` (or merge with existing engine imports):
```js
import { saveState, loadState } from './engine.js';
```

Add a debouncer above `setState`:
```js
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
const debouncedSave = debounce(() => saveState(state, puzzle), 150);
```

Update `setState`:
```js
function setState(next) {
  state = next;
  $autoCheck.checked = state.autoCheck;
  renderState(puzzle, state, marks);
  debouncedSave();
}
```

Update bootstrap (replace the line `state = createInitialState(puzzle);` with):
```js
state = loadState(puzzle) ?? createInitialState(puzzle);
```

- [ ] **Step 2: Smoke-check**

Open the page, type a few letters, reload. Letters persist. Open in a private browser window: state is fresh (no leakage between profiles).

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(ui): debounced save and load on init"
```

---

## Task 20: Bootstrap — fetch the real `puzzle.ipuz`

**Files:**
- Modify: `app.js`

Remove the hard-coded `DEV_PUZZLE` block and replace with a fetch. Support `?p=<filename>` URL override. Show a friendly error if the fetch fails.

- [ ] **Step 1: Modify `app.js`**

Remove the entire `DEV_PUZZLE` constant and the four-line block that uses it (the four lines starting with `puzzle = parseIpuz(DEV_PUZZLE);`).

Replace with:
```js
async function bootstrap() {
  const params = new URLSearchParams(location.search);
  const url = params.get('p') ?? './puzzle.ipuz';
  let raw;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (e) {
    $title.textContent = 'Could not load puzzle';
    $grid.textContent = `Error: ${e.message}. Check that ${url} exists next to crossword.html.`;
    $grid.style.background = 'transparent';
    $grid.style.padding = '12px';
    return;
  }
  puzzle = parseIpuz(raw);
  $title.textContent = puzzle.title || 'Crossword';
  state = loadState(puzzle) ?? createInitialState(puzzle);
  marks = new Set();
  $autoCheck.checked = state.autoCheck;
  renderGrid(puzzle);
  renderState(puzzle, state, marks);
  focusHidden();
}

bootstrap();
```

- [ ] **Step 2: Smoke-check**

Without a `puzzle.ipuz` file, the page should now show "Could not load puzzle" and an error message. With a file (Task 21 puts one there), the real puzzle renders. We'll verify both paths in Task 22.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat(ui): bootstrap fetches puzzle.ipuz with URL override"
```

---

## Task 21: Generate `puzzle.ipuz` from the canonical grid + answer key

**Files:**
- Create: `puzzle.ipuz`

**Canonical inputs (already in the project directory):**
- `solution-filled.txt` — the filled 15×15 grid (one row per line, prefixed with a row number; `.` denotes a block). This is the answer key.
- `Across the Solar System (and down) v2.pdf` — the printed clue document. Source for the clue text, which goes into `clues.Across` and `clues.Down`. Note the PDF's clue numbering uses 1-letter entries (the engine's `computeNumbering` will produce matching numbers — see Task 3).

**Building the `puzzle` field:** the canonical `.ipuz` `puzzle` field uses `0` for "white, no number" and an integer for "white, numbered." Since the engine recomputes numbering, we can simplify: write `0` for every white cell and the block character for blocks. The engine ignores authored numbering anyway.

- [ ] **Step 1: Read `solution-filled.txt` and confirm shape**

The file has 15 lines (rows 1–15), each with a number, a tab, and a 15-character grid row. Strip the row number and tab; the 15-char string is the grid row. Block character is `.`.

If the file is missing or malformed, stop and ask the user.

- [ ] **Step 2: Build `puzzle.ipuz` from the inputs**

For each row of the user-supplied grid, build a row of `.ipuz` `puzzle` and `solution` arrays:
- Block character → `"#"` in both `puzzle` and `solution`.
- White cell with letter `X` → `0` in `puzzle`, `"X"` (uppercase) in `solution`.

Write `puzzle.ipuz` with this shape:
```json
{
  "version": "http://ipuz.org/v1",
  "kind": ["http://ipuz.org/crossword#1"],
  "title": "Across the Solar System (and down)",
  "author": "Carrington House",
  "copyright": "© 2026",
  "publisher": "Antfarm and Planetarium",
  "id": "planets-v2",
  "dimensions": { "width": 15, "height": 15 },
  "block": "#",
  "puzzle": [ /* 15 rows of 15 entries */ ],
  "solution": [ /* 15 rows of 15 entries */ ],
  "clues": {
    "Across": [ [1, "Freddie of Queen"], [8, "View in Paris"], ... ],
    "Down":   [ [1, "Identify incorrectly"], ... ]
  }
}
```

The clue list comes from the PDF; transcribe each clue as a `[number, "text"]` pair. If a clue starts with `*` in the PDF (cryptic), keep the asterisk in the text — that's how it was authored.

- [ ] **Step 3: Validate by loading the page**

Run `python3 -m http.server 8000` from the project root, open `http://localhost:8000/crossword.html`. Expected:
- Title shows "Across the Solar System (and down)".
- A 15×15 grid renders with the right block pattern.
- Cell numbers in the right corners.
- Type one correct letter from the clue list and one wrong letter; toggle auto-check; verify the wrong letter shows red.

- [ ] **Step 4: Commit**

```bash
git add puzzle.ipuz
git commit -m "feat(data): canonical puzzle.ipuz for Across the Solar System (and down)"
```

---

## Task 22: Manual end-to-end smoke test

**Files:** none (verification only).

Use the actual page on a phone (iOS Safari and/or Android Chrome) and a desktop browser. Walk through this checklist. Each item must pass before claiming done.

**Loading**
- [ ] Page loads with no console errors.
- [ ] Title and grid match the puzzle.
- [ ] Visiting `?p=puzzle.ipuz` loads the same puzzle (URL override works).
- [ ] Visiting `?p=missing.ipuz` shows a friendly error, no crash.

**Desktop input**
- [ ] Typing letters fills cells and advances cursor.
- [ ] Cursor stops at last cell of word (no auto-jump).
- [ ] Space toggles direction; cursor unchanged.
- [ ] Arrow keys move; perpendicular arrows flip direction.
- [ ] Backspace clears + moves back; on a non-empty cell only clears.
- [ ] Tab / Shift-Tab cycle through words across→down→wrap.
- [ ] Enter does nothing (no scroll, no submit).
- [ ] Clicking a cell focuses it; clicking same cell toggles direction.

**Mobile input (iPhone)**
- [ ] Tapping a cell raises the keyboard.
- [ ] Letters type and advance.
- [ ] No iOS auto-zoom on focus (16px hidden input).
- [ ] No autocapitalize/autocorrect glitches (e.g. typing fast doesn't insert weird chars).
- [ ] Tapping the focused cell toggles direction.

**Toolbar**
- [ ] Auto-check off: wrong letters not marked while typing.
- [ ] Press Check: wrong letters go red.
- [ ] Type over a red letter: mark clears.
- [ ] Toggle auto-check on: marks reflect live state.
- [ ] Toggle auto-check off after some marks were shown: marks persist (don't auto-clear).
- [ ] Reveal Letter fills the active cell, makes it blue, refuses further edits.
- [ ] Reveal Word fills the active word, locks all cells.
- [ ] Reveal Puzzle fills everything, locks everything, does NOT show the Solved overlay.
- [ ] Clear shows a confirm dialog; on cancel, nothing happens; on OK, grid empties (cursor and direction kept).

**Completion**
- [ ] After typing the final correct letter (no Reveal involved), the Solved! overlay fades in.
- [ ] Esc dismisses; clicking backdrop dismisses; Close button dismisses.
- [ ] After dismiss, grid remains visible and editable.
- [ ] Reload after solving: solvedAt persists (overlay does not re-pop, but the state is preserved).

**Persistence**
- [ ] Reloading the page restores entries, locked, cursor, direction, autoCheck.
- [ ] Different browser / private window starts blank (no leakage).
- [ ] Replacing `puzzle.ipuz` with a different-dimension puzzle resets state (no crash).

**Hosting**
- [ ] Upload the four files (`crossword.html`, `engine.js`, `app.js`, `puzzle.ipuz`) to the user's web host.
- [ ] Open the deployed URL; confirm it works as in local smoke test.

If any item fails, fix it and re-run that item before moving on.

- [ ] **Step 1: Walk the checklist**

(No code; tick each item as you verify.)

- [ ] **Step 2: Commit any fixes that arose during testing**

If fixes were needed:
```bash
git add .
git commit -m "fix: <describe>"
```
Otherwise no commit needed.

---

## Self-Review

Before handing this plan back, the planner verified:

**Spec coverage** — every section of the spec maps to a task:
- Architecture (HTML/JS split, .ipuz, fetch, no build) — Tasks 1, 13, 20.
- Loading via `?p=` URL param — Task 20.
- Persistence (localStorage, per-puzzle key, dimension guard, debounced save) — Tasks 12, 19.
- Internal puzzle model — Tasks 2, 3.
- Solver state shape — Task 4.
- Grid render with numbers, blocks, letters — Task 14.
- Active cell + active word highlights — Task 14.
- Direction state + arrow on active cell — covered by `direction` in state and CSS class; the small arrow icon is omitted for v1 (the active-cell highlight + active-word band reads the direction unambiguously). The spec mentioned "a small arrow icon"; this is acknowledged as a deferred polish item — see Notes below.
- Keyboard handling: A–Z, space, backspace, arrows, tab, enter — Tasks 5–8, 15.
- Pointer click/tap — Tasks 9, 16.
- Mobile keyboard via hidden input — Tasks 13, 15.
- Toolbar (auto-check toggle, Check, Reveal menu, Clear) — Task 17. The Reveal menu is implemented as three separate buttons rather than a dropdown — simpler and equally clear on mobile.
- Locked cells styling + edit refusal — Task 14 (style), Task 5 (engine refusal).
- Wrong-letter marks lifecycle (auto-check on/off behaviors) — Task 17 (Check populates marks; clearMark on edit).
- Completion overlay — Task 18.
- Reveal letter/word/puzzle, clearAll — Tasks 11, 17.
- Wrong cells / isSolved / isCorrect — Task 10.

**Notes / minor deviations from spec**
- The spec mentioned "a small arrow icon on the active cell" to indicate direction. The plan ships v1 without it — the active-word highlight band itself indicates the direction. If the user wants the icon afterward, it's a 5-line CSS addition.
- The spec mentioned a "Reveal ▾ dropdown." The plan uses three separate buttons. Equivalent in function; less fiddly on mobile. Easy to convert to a dropdown later if desired.

**Post-write update (2026-05-10)**
- After confirming `solution-filled.txt` against the PDF's clue numbering (max 74 across, 68 down), the engine's numbering rule was generalized: a cell starts an entry iff it has no white cell to its left (or no white cell above, for down) — without requiring length ≥ 2. This brings 4 horizontally-isolated single-letter cells (M, A, E, C in this puzzle) into the numbering as #21, #24, #58, #61 respectively, matching the printed clue sheet. The spec, Task 3 (rule + tests + impl), Task 8 (cycle through 1-letter entries too), and Task 9 (no direction-fallback needed since every white cell now has both an across and down word) were updated accordingly.

**Placeholder scan** — no "TBD"/"TODO" instructions left in the plan. Task 21 has a hard "stop and ask the user" gate in Step 1 — that's the one place where execution must pause for input, not a placeholder.

**Type consistency** — `state` and `puzzle` shapes used in later tasks match those defined in earlier tasks. Function names are consistent across tasks (`setState`, `marks`, `puzzle`, `state`).

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-10-crossword-checker.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

2. **Inline Execution** — I execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
