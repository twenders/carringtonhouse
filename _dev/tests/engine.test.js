import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIpuz } from '../../engine.js';

test('engine module loads', async () => {
  const engine = await import('../../engine.js');
  assert.equal(typeof engine, 'object');
});

const tinyIpuz = {
  kind: ['http://ipuz.org/crossword#1'],
  dimensions: { width: 3, height: 3 },
  puzzle: [
    [0, 0, 0],
    [0, '#', 0],
    [0, 0, 0],
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

test('parseIpuz extracts subtitle, author, publisher, publisherUrl, and date', () => {
  const meta = {
    ...tinyIpuz,
    subtitle: 'A small one',
    author: 'Test Author',
    publisher: 'Test Publisher',
    publisher_url: 'https://example.com/',
    date: '05/2026',
  };
  const p = parseIpuz(meta);
  assert.equal(p.subtitle, 'A small one');
  assert.equal(p.author, 'Test Author');
  assert.equal(p.publisher, 'Test Publisher');
  assert.equal(p.publisherUrl, 'https://example.com/');
  assert.equal(p.date, '05/2026');
});

test('parseIpuz defaults missing optional metadata to empty strings', () => {
  const p = parseIpuz(tinyIpuz);
  assert.equal(p.subtitle, '');
  assert.equal(p.author, '');
  assert.equal(p.publisher, '');
  assert.equal(p.publisherUrl, '');
  assert.equal(p.date, '');
});

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

test('computeNumbering honors explicit positive-integer labels on entry-start cells', () => {
  // Same layout as tinyIpuz, but with explicit labels in puzzle[].
  // The auto-counter still advances in reading order at every entry-start;
  // any cell with a positive integer overrides that auto value as its display label.
  const labeled = {
    ...tinyIpuz,
    puzzle: [
      [10, 0, 0],
      [0, '#', 0],
      [0, 0, 99],
    ],
  };
  const p = parseIpuz(labeled);
  // Entry-start cells in reading order: (0,0), (0,1), (0,2), (1,0), (1,2), (2,0), (2,1).
  // Auto-counter would give 1..7. Explicit positive ints override.
  assert.equal(p.cells[0][0].number, 10); // explicit
  assert.equal(p.cells[0][1].number, 2);  // auto
  assert.equal(p.cells[0][2].number, 3);  // auto
  assert.equal(p.cells[1][0].number, 4);  // auto
  assert.equal(p.cells[1][2].number, 5);  // auto
  assert.equal(p.cells[2][0].number, 6);  // auto
  assert.equal(p.cells[2][1].number, 7);  // auto
  // (2,2) is not an entry start, but has explicit label 99 → still shown.
  assert.equal(p.cells[2][2].number, 99);
});

test('computeNumbering uses display label as entry num (acrossStarts/downStarts)', () => {
  const labeled = {
    ...tinyIpuz,
    puzzle: [
      [10, 0, 0],
      [0, '#', 0],
      [0, 0, 0],
    ],
  };
  const p = parseIpuz(labeled);
  // The entry at (0,0) should have num 10, not the auto value 1.
  const a1 = p.numbering.acrossStarts.find(w => w.r === 0 && w.c === 0);
  const d1 = p.numbering.downStarts.find(w => w.r === 0 && w.c === 0);
  assert.equal(a1.num, 10);
  assert.equal(d1.num, 10);
  // Cells in that across word should reference the same entry.
  assert.equal(p.cells[0][0].acrossWord.num, 10);
  assert.equal(p.cells[0][2].acrossWord.num, 10);
});

test('computeNumbering ignores non-positive-integer values in puzzle[] (treats as 0)', () => {
  // Strings (other than block), nulls, floats, and negatives all fall back to auto-numbering.
  const odd = {
    ...tinyIpuz,
    puzzle: [
      [null, 'foo', -3],
      [1.5, '#', 0],
      [0, 0, 0],
    ],
  };
  const p = parseIpuz(odd);
  assert.equal(p.cells[0][0].number, 1);
  assert.equal(p.cells[0][1].number, 2);
  assert.equal(p.cells[0][2].number, 3);
  assert.equal(p.cells[1][0].number, 4);
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

import { createInitialState } from '../../engine.js';

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

import { typeLetter } from '../../engine.js';

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

test('typeLetter overrides a locked cell and clears its lock', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = { ...s, locked: { '0,0': true }, entries: { '0,0': 'A' } };
  const after = typeLetter(s, p, 'Z');
  assert.equal(after.entries['0,0'], 'Z');
  assert.equal(after.locked['0,0'], undefined);
  assert.deepEqual(after.cursor, { r: 0, c: 1 });
});

test('typeLetter does not mutate input state', () => {
  const p = parseIpuz(tinyIpuz);
  const s = createInitialState(p);
  const snapshot = JSON.stringify(s);
  typeLetter(s, p, 'M');
  assert.equal(JSON.stringify(s), snapshot);
});

import { backspace } from '../../engine.js';

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

test('backspace on a locked active cell clears entry and lock', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = {
    ...s,
    cursor: { r: 0, c: 1 },
    entries: { '0,1': 'B' },
    locked: { '0,1': true },
  };
  s = backspace(s, p);
  assert.equal(s.entries['0,1'], undefined);
  assert.equal(s.locked['0,1'], undefined);
  assert.deepEqual(s.cursor, { r: 0, c: 1 });
});

test('backspace from an empty cell deletes the previous cell regardless of lock', () => {
  const p = parseIpuz(tinyIpuz);
  let s = createInitialState(p);
  s = {
    ...s,
    cursor: { r: 0, c: 2 },
    entries: { '0,0': 'A', '0,1': 'B' },
    locked: { '0,1': true },
  };
  s = backspace(s, p);
  assert.equal(s.entries['0,1'], undefined);
  assert.equal(s.locked['0,1'], undefined);
  assert.equal(s.entries['0,0'], 'A');
  assert.deepEqual(s.cursor, { r: 0, c: 1 });
});

import { moveCursor, toggleDirection } from '../../engine.js';

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

import { tabToWord } from '../../engine.js';

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

import { clickCell } from '../../engine.js';

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

import { isCorrect, wrongCells, isSolved, setAutoCheck } from '../../engine.js';

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

import { revealLetter, revealWord, revealPuzzle, clearAll } from '../../engine.js';

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

test('revealWord on a 1-letter word fills just that one cell', () => {
  const p = parseIpuz(tinyIpuz);
  // (1,0) is the 1-letter across entry 4A (D). revealWord should fill only (1,0).
  let s = { ...createInitialState(p), cursor: { r: 1, c: 0 }, direction: 'across' };
  s = revealWord(s, p);
  assert.equal(s.entries['1,0'], 'D');
  assert.equal(s.locked['1,0'], true);
  // No other cells should be filled or locked.
  assert.equal(Object.keys(s.entries).length, 1);
  assert.equal(Object.keys(s.locked).length, 1);
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

import { saveState, loadState } from '../../engine.js';

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
