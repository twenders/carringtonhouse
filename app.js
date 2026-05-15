import {
  parseIpuz, createInitialState, wrongCells,
  typeLetter, backspace, toggleDirection, moveCursor, tabToWord, clickCell,
  setAutoCheck, revealLetter, revealWord, revealPuzzle, clearWord, clearAll,
  wrongCells as engineWrong, isSolved, saveState, loadState,
  loadUploads, saveUploads, addUpload, renameUpload, deleteUpload,
} from './engine.js';

const $ = (sel) => document.querySelector(sel);
const $grid = $('#grid');
const $title = $('#title');
const $subtitle = $('#subtitle');
const $author = $('#author');
const $publisher = $('#publisher');
const $clueBar = $('#clue-bar');
const $clueText = $('#clue-text');
const $cluePrev = $('#clue-prev');
const $clueNext = $('#clue-next');

let puzzle = null;
let state = null;
let marks = new Set();   // "r,c" cells flagged wrong (used when autoCheck is off)

export function renderGrid(p) {
  $grid.style.gridTemplateColumns = `repeat(${p.cols}, minmax(0, 1fr))`;
  $grid.style.gridTemplateRows = `repeat(${p.rows}, minmax(0, 1fr))`;
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
  renderClue(p, s);
}

function renderClue(p, s) {
  if (!p.hasClues) return;
  const cell = p.cells[s.cursor.r][s.cursor.c];
  if (cell.isBlock) { $clueText.textContent = ''; return; }
  const word = s.direction === 'across' ? cell.acrossWord : cell.downWord;
  if (!word) { $clueText.textContent = ''; return; }
  const dirSuffix = s.direction === 'across' ? 'A' : 'D';
  const clueText = p.clues[s.direction][word.num];
  $clueText.replaceChildren();
  const label = document.createElement('span');
  label.className = 'clue-label';
  label.textContent = `${word.num}${dirSuffix}`;
  $clueText.appendChild(label);
  if (clueText) {
    $clueText.appendChild(document.createTextNode(clueText));
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

$cluePrev.addEventListener('click', () => {
  if (!puzzle || !state) return;
  setState(tabToWord(state, puzzle, true));
  focusHidden();
});
$clueNext.addEventListener('click', () => {
  if (!puzzle || !state) return;
  setState(tabToWord(state, puzzle, false));
  focusHidden();
});

// Toolbar wiring
const $autoCheck   = $('#auto-check');
const $check       = $('#check');
const $revealLetter  = $('#reveal-letter');
const $revealWord    = $('#reveal-word');
const $revealPuzzle  = $('#reveal-puzzle');
const $clearWord   = $('#clear-word');
const $clearPuzzle = $('#clear-puzzle');
function allMenus() { return document.querySelectorAll('details.menu'); }

function closeMenus() {
  allMenus().forEach(m => { m.open = false; });
}

function wireMenu(m) {
  m.addEventListener('toggle', () => {
    if (m.open) allMenus().forEach(other => { if (other !== m) other.open = false; });
  });
}

allMenus().forEach(wireMenu);
document.addEventListener('click', (ev) => {
  for (const m of allMenus()) {
    if (m.open && !m.contains(ev.target)) m.open = false;
  }
  for (const m of document.querySelectorAll('.picker-row-menu[open]')) {
    if (!m.contains(ev.target)) m.open = false;
  }
});

$autoCheck.addEventListener('change', () => {
  setState(setAutoCheck(state, $autoCheck.checked));
});

$check.addEventListener('click', () => {
  closeMenus();
  if (state.autoCheck) { focusHidden(); return; }
  marks = new Set(engineWrong(state, puzzle).map(([r, c]) => `${r},${c}`));
  renderState(puzzle, state, marks);
  focusHidden();
});

$revealLetter.addEventListener('click',  () => { closeMenus(); clearMark(state.cursor.r, state.cursor.c); setState(revealLetter(state, puzzle));  focusHidden(); });
$revealWord.addEventListener('click', () => {
  closeMenus();
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
$revealPuzzle.addEventListener('click',  () => { closeMenus(); marks = new Set(); setState(revealPuzzle(state, puzzle));  focusHidden(); });

$clearWord.addEventListener('click', () => {
  closeMenus();
  const cell = puzzle.cells[state.cursor.r][state.cursor.c];
  const word = state.direction === 'across' ? cell.acrossWord : cell.downWord;
  if (word) {
    for (let i = 0; i < word.len; i++) {
      const wr = word.r + (state.direction === 'down' ? i : 0);
      const wc = word.c + (state.direction === 'across' ? i : 0);
      clearMark(wr, wc);
    }
  }
  setState(clearWord(state, puzzle));
  focusHidden();
});

$clearPuzzle.addEventListener('click', () => {
  closeMenus();
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

async function fetchManifest() {
  try {
    const res = await fetch('./puzzles/puzzles.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const list = await res.json();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

let currentManifest = [];
let currentActiveKey = null;

function navigateToKey(key) {
  location.search = '?p=' + encodeURIComponent(key);
}

function buildPuzzleRows(manifest, uploads) {
  const uploadRows = Object.entries(uploads).map(([slug, e]) => ({
    kind: 'upload',
    key: `uploaded:${slug}`,
    slug,
    title: e.title || slug,
    date: e.addedAt || '',
  }));
  const hostedRows = manifest.map(m => ({
    kind: 'hosted',
    key: m.file,
    title: m.title || m.file,
    date: m.date || '',
  }));
  const rows = [...uploadRows, ...hostedRows];
  rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows;
}

function renderPuzzleList() {
  const list = document.getElementById('puzzle-list');
  if (!list) return;
  const uploads = loadUploads();
  const rows = buildPuzzleRows(currentManifest, uploads);
  list.textContent = '';
  for (const row of rows) {
    const li = document.createElement('li');
    li.className = 'picker-row';
    if (row.kind === 'upload') li.dataset.slug = row.slug;
    if (row.key === currentActiveKey) li.setAttribute('aria-current', 'true');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-item-button';
    const titleEl = document.createElement('span');
    titleEl.className = 'picker-item-title';
    titleEl.textContent = row.title;
    btn.appendChild(titleEl);
    if (row.date) {
      const dateEl = document.createElement('span');
      dateEl.className = 'picker-item-date';
      dateEl.textContent = row.kind === 'upload' ? formatUploadedDate(row.date) : row.date;
      btn.appendChild(dateEl);
    }
    btn.addEventListener('click', () => navigateToKey(row.key));
    li.appendChild(btn);

    if (row.kind === 'upload') {
      li.appendChild(buildRowMenu(row));
    }
    list.appendChild(li);
  }
}

function formatUploadedDate(iso) {
  // Render ISO timestamp as YYYY-MM-DD; fall back to whatever's stored.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? `Uploaded ${m[1]}` : `Uploaded ${iso}`;
}

function buildRowMenu(row) {
  const details = document.createElement('details');
  details.className = 'picker-row-menu';
  const summary = document.createElement('summary');
  summary.setAttribute('aria-label', 'More options');
  summary.textContent = '⋮';
  details.appendChild(summary);

  const content = document.createElement('div');
  content.className = 'menu-content';

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'menu-item';
  renameBtn.textContent = 'Rename';
  renameBtn.addEventListener('click', () => {
    details.open = false;
    startRename(row.slug);
  });
  content.appendChild(renameBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'menu-item menu-item-destructive';
  deleteBtn.textContent = 'Delete';
  let pending = false;
  deleteBtn.addEventListener('click', () => {
    if (!pending) {
      pending = true;
      deleteBtn.textContent = 'Confirm delete?';
      return;
    }
    commitDelete(row.slug);
  });
  details.addEventListener('toggle', () => {
    if (!details.open) {
      pending = false;
      deleteBtn.textContent = 'Delete';
    } else {
      // Close any other open row menus.
      for (const other of document.querySelectorAll('.picker-row-menu[open]')) {
        if (other !== details) other.open = false;
      }
    }
  });
  content.appendChild(deleteBtn);

  details.appendChild(content);
  return details;
}

function startRename(slug) {
  const list = document.getElementById('puzzle-list');
  if (!list) return;
  const uploads = loadUploads();
  if (!uploads[slug]) return;
  const targetRow = list.querySelector(`.picker-row[data-slug="${CSS.escape(slug)}"]`);
  if (!targetRow) { renderPuzzleList(); return; }
  const btn = targetRow.querySelector('.picker-item-button');
  const menu = targetRow.querySelector('.picker-row-menu');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'picker-rename-input';
  input.value = uploads[slug].title;
  targetRow.replaceChild(input, btn);
  if (menu) menu.style.display = 'none';
  input.focus();
  input.select();

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;
    const next = renameUpload(loadUploads(), slug, input.value);
    saveUploads(next.uploads);
    if (currentActiveKey === `uploaded:${slug}` && next.slug !== slug) {
      currentActiveKey = `uploaded:${next.slug}`;
      history.replaceState(null, '', '?p=' + encodeURIComponent(currentActiveKey));
    }
    renderPuzzleList();
  };
  const cancel = () => {
    if (done) return;
    done = true;
    renderPuzzleList();
  };
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
    else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}

function commitDelete(slug) {
  const next = deleteUpload(loadUploads(), slug);
  saveUploads(next);
  if (currentActiveKey === `uploaded:${slug}`) {
    location.search = '';
    return;
  }
  renderPuzzleList();
}

function wireUpload() {
  const btn = document.getElementById('upload-puzzle');
  const input = document.getElementById('upload-input');
  const err = document.getElementById('upload-error');
  if (!btn || !input) return;
  function showError(msg) {
    if (!err) return;
    err.textContent = msg;
    err.hidden = false;
  }
  function clearError() {
    if (!err) return;
    err.textContent = '';
    err.hidden = true;
  }
  btn.addEventListener('click', () => {
    clearError();
    input.value = '';
    input.click();
  });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    let text, ipuz;
    try {
      text = await file.text();
      ipuz = JSON.parse(text);
    } catch (e) {
      showError(`Could not read file: ${e.message}`);
      return;
    }
    try {
      parseIpuz(ipuz);
    } catch (e) {
      showError(`Not a valid .ipuz file: ${e.message}`);
      return;
    }
    const { uploads, slug } = addUpload(loadUploads(), { filename: file.name, raw: text });
    saveUploads(uploads);
    navigateToKey(`uploaded:${slug}`);
  });
}

function showLoadError(msg) {
  $title.textContent = 'Could not load puzzle';
  $grid.textContent = msg;
  $grid.style.background = 'transparent';
  $grid.style.padding = '12px';
}

async function bootstrap() {
  const params = new URLSearchParams(location.search);
  const manifest = await fetchManifest();
  currentManifest = manifest;
  const requested = params.get('p');
  const defaultKey = manifest.length
    ? manifest[manifest.length - 1].file
    : '26-05-universe.ipuz';
  const key = requested ?? defaultKey;
  currentActiveKey = key;
  let raw;
  if (key.startsWith('uploaded:')) {
    const slug = key.slice('uploaded:'.length);
    const entry = loadUploads()[slug];
    if (!entry) {
      showLoadError('No uploaded puzzle found at that name.');
      renderPuzzleList();
      return;
    }
    try {
      raw = JSON.parse(entry.raw);
    } catch (e) {
      showLoadError(`Uploaded puzzle is corrupted: ${e.message}`);
      renderPuzzleList();
      return;
    }
  } else {
    const url = `./puzzles/${key}`;
    try {
      const res = await fetch(url, { cache: 'default' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      raw = await res.json();
    } catch (e) {
      showLoadError(`Cannot find ${url}`);
      renderPuzzleList();
      return;
    }
  }
  puzzle = parseIpuz(raw);
  $title.textContent = puzzle.title || 'Crossword';
  renderPuzzleList();
  $subtitle.textContent = puzzle.subtitle;
  $subtitle.hidden = !puzzle.subtitle;
  if (puzzle.author) {
    $author.textContent = `By ${puzzle.author}`;
    $author.hidden = false;
  } else {
    $author.textContent = '';
    $author.hidden = true;
  }
  $publisher.textContent = '';
  if (puzzle.publisher) {
    if (puzzle.publisherUrl) {
      const a = document.createElement('a');
      a.href = puzzle.publisherUrl;
      a.textContent = puzzle.publisher;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      $publisher.appendChild(a);
    } else {
      $publisher.appendChild(document.createTextNode(puzzle.publisher));
    }
    if (puzzle.date) {
      $publisher.appendChild(document.createTextNode(`, ${puzzle.date}`));
    }
    $publisher.hidden = false;
  } else {
    $publisher.hidden = true;
  }
  state = loadState(puzzle) ?? createInitialState(puzzle);
  marks = new Set();
  $autoCheck.checked = state.autoCheck;
  $clueBar.hidden = !puzzle.hasClues;
  document.body.classList.toggle('has-clues', puzzle.hasClues);
  renderGrid(puzzle);
  renderState(puzzle, state, marks);
  focusHidden();
  if (state.solvedAt) showOverlay();
}

wireUpload();
bootstrap();
