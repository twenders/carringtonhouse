import {
  parseIpuz, createInitialState, wrongCells,
  typeLetter, backspace, toggleDirection, moveCursor, tabToWord, clickCell,
  setAutoCheck, revealLetter, revealWord, revealPuzzle, clearAll,
  wrongCells as engineWrong, isSolved, saveState, loadState,
} from './engine.js';

const $ = (sel) => document.querySelector(sel);
const $grid = $('#grid');
const $title = $('#title');
const $subtitle = $('#subtitle');
const $author = $('#author');

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

const $hidden = $('#hidden-input');

function focusHidden() {
  // On iOS this raises the keyboard. Calling preventScroll keeps the page from jumping.
  $hidden.focus({ preventScroll: true });
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
const debouncedSave = debounce(() => saveState(state, puzzle), 150);

function setState(next) {
  state = next;
  $autoCheck.checked = state.autoCheck;
  renderState(puzzle, state, marks);
  debouncedSave();
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
    const next = typeLetter(state, puzzle, k);
    setState(maybeMarkSolved(next));
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
    const next = typeLetter(state, puzzle, data);
    setState(maybeMarkSolved(next));
  }
  // Always wipe the input so it never accumulates value.
  $hidden.value = '';
});

window.addEventListener('load', focusHidden);

$grid.addEventListener('click', (ev) => {
  const target = ev.target.closest('.cell');
  if (!target || !target.dataset.r) return;
  const r = +target.dataset.r; const c = +target.dataset.c;
  if (puzzle.cells[r][c].isBlock) return;
  setState(clickCell(state, puzzle, r, c));
  focusHidden();
});

// Toolbar wiring
const $autoCheck   = $('#auto-check');
const $check       = $('#check');
const $revealLetter  = $('#reveal-letter');
const $revealWord    = $('#reveal-word');
const $revealPuzzle  = $('#reveal-puzzle');
const $clear       = $('#clear');

$autoCheck.addEventListener('change', () => {
  setState(setAutoCheck(state, $autoCheck.checked));
});

$check.addEventListener('click', () => {
  if (state.autoCheck) return;
  marks = new Set(engineWrong(state, puzzle).map(([r, c]) => `${r},${c}`));
  renderState(puzzle, state, marks);
  focusHidden();
});

$revealLetter.addEventListener('click',  () => { clearMark(state.cursor.r, state.cursor.c); setState(revealLetter(state, puzzle));  focusHidden(); });
$revealWord.addEventListener('click', () => {
  const cell = puzzle.cells[state.cursor.r][state.cursor.c];
  const word = state.direction === 'across' ? cell.acrossWord : cell.downWord;
  if (word) {
    for (let i = 0; i < word.len; i++) {
      const wr = word.r + (state.direction === 'down' ? i : 0);
      const wc = word.c + (state.direction === 'across' ? i : 0);
      clearMark(wr, wc);
    }
  }
  setState(revealWord(state, puzzle));
  focusHidden();
});
$revealPuzzle.addEventListener('click',  () => { marks = new Set(); setState(revealPuzzle(state, puzzle));  focusHidden(); });

$clear.addEventListener('click', () => {
  if (!confirm('Clear all your progress?')) return;
  marks = new Set();
  setState(clearAll(state));
  focusHidden();
});

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

async function bootstrap() {
  const params = new URLSearchParams(location.search);
  const url = params.get('p') ?? './26-05-universe.ipuz';
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
  $subtitle.textContent = puzzle.subtitle;
  $subtitle.hidden = !puzzle.subtitle;
  $author.textContent = puzzle.author ? `By ${puzzle.author}` : '';
  $author.hidden = !puzzle.author;
  state = loadState(puzzle) ?? createInitialState(puzzle);
  marks = new Set();
  $autoCheck.checked = state.autoCheck;
  renderGrid(puzzle);
  renderState(puzzle, state, marks);
  focusHidden();
  if (state.solvedAt) showOverlay();
}

bootstrap();
